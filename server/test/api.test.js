const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { today, daysFromToday } = require('../utils/dates');

test('date-only helpers use the Kolkata day and inclusive boundaries', () => {
  assert.equal(today(new Date('2026-10-25T18:30:00.000Z')), '2026-10-26');
  assert.equal(daysFromToday('2026-11-02', '2026-10-26'), 7);
  assert.equal(daysFromToday('2027-01-24', '2026-10-26'), 90);
  assert.equal(daysFromToday('2026-11-01', '2026-10-26'), 6);
  assert.equal(daysFromToday('2027-01-25', '2026-10-26'), 91);
  assert.ok(Number.isNaN(daysFromToday('2026-02-30', '2026-02-01')));
});

const databasePath = path.join(os.tmpdir(), `art-editorial-test-${process.pid}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-sessions';
process.env.DB_PATH = databasePath;
process.env.FRONTEND_URL = 'http://localhost';

let app;
let db;
let bcrypt;
let server;
let origin;
let testPaintingId;

before(async () => {
  app = require('../app');
  db = require('../db/init');
  bcrypt = require('bcryptjs');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM paintings').get().count, 6);
  db.exec('DELETE FROM events; DELETE FROM pottery_requests; DELETE FROM wall_bookings; DELETE FROM orders; DELETE FROM paintings; DELETE FROM users;');
  const adminHash = bcrypt.hashSync('AdminPassword123!', 4);
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run('Studio Admin', 'admin@example.test', adminHash);
  const testPainting = db.prepare('INSERT INTO paintings (title, artist, description, price, image_url) VALUES (?, ?, ?, ?, ?)')
    .run('Studio Painting', 'Artist', 'A test painting.', 1800, '');
  testPaintingId = testPainting.lastInsertRowid;
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (db) db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const filename = `${databasePath}${suffix}`;
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
  }
});

async function call(route, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${origin}/api${route}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    response,
    data: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0]
  };
}

function dateIn(days) {
  const current = today();
  const date = new Date(`${current}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test('API enforces sessions, roles, ownership, transactional orders, bookings, and pottery transitions', async () => {
  const unauthenticated = await call('/paintings');
  assert.equal(unauthenticated.response.status, 401);

  const firstSignup = await call('/auth/signup', {
    method: 'POST',
    body: { name: 'Customer One', email: 'one@example.test', password: 'CustomerPass123!' }
  });
  const secondSignup = await call('/auth/signup', {
    method: 'POST',
    body: { name: 'Customer Two', email: 'two@example.test', password: 'CustomerPass123!' }
  });
  assert.equal(firstSignup.response.status, 201);
  assert.equal(secondSignup.response.status, 201);
  const firstCookie = firstSignup.cookie;
  const secondCookie = secondSignup.cookie;

  const duplicate = await call('/auth/signup', {
    method: 'POST',
    body: { name: 'Duplicate', email: 'ONE@example.test', password: 'CustomerPass123!' }
  });
  assert.equal(duplicate.response.status, 409);

  const adminLogin = await call('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'AdminPassword123!' }
  });
  assert.equal(adminLogin.response.status, 200);
  const adminCookie = adminLogin.cookie;

  const directPage = await fetch(`${origin}/gallery/1`);
  assert.equal(directPage.status, 200);
  assert.match(await directPage.text(), /Hauser&amp;Wirth/);
  const configScript = await fetch(`${origin}/api/config.js`);
  assert.match(await configScript.text(), /ART_API_BASE_URL/);
  const corsCheck = await fetch(`${origin}/api/meta`, { headers: { origin: 'http://localhost' } });
  assert.equal(corsCheck.headers.get('access-control-allow-origin'), 'http://localhost');

  assert.equal((await call('/paintings', { cookie: firstCookie })).response.status, 200);
  assert.equal((await call(`/paintings/${testPaintingId}/orders`, { method: 'POST', cookie: adminCookie })).response.status, 403);
  assert.equal((await call('/paintings', {
    method: 'POST', cookie: firstCookie,
    body: { title: 'Not allowed', artist: 'Customer', description: 'No', price: 100 }
  })).response.status, 403);
  const createdPainting = await call('/paintings', {
    method: 'POST', cookie: adminCookie,
    body: { title: 'New Work', artist: 'Studio Artist', description: 'A new original.', price: 2600, image_url: '' }
  });
  assert.equal(createdPainting.response.status, 201);
  assert.equal(createdPainting.data.painting.available, true);
  assert.equal((await call(`/paintings/${createdPainting.data.painting.id}`, {
    method: 'PATCH', cookie: firstCookie, body: { title: 'No customer edits' }
  })).response.status, 403);

  const race = await Promise.all(Array.from({ length: 10 }, (_, index) => call(`/paintings/${testPaintingId}/orders`, {
    method: 'POST', cookie: index % 2 ? firstCookie : secondCookie
  })));
  assert.equal(race.filter(result => result.response.status === 201).length, 1);
  assert.equal(race.filter(result => result.response.status === 409).length, 9);
  const winnerResponse = race.find(result => result.response.status === 201);
  const winnerCookieForOrder = race.indexOf(winnerResponse) % 2 ? firstCookie : secondCookie;
  const otherCookie = winnerCookieForOrder === firstCookie ? secondCookie : firstCookie;
  const placed = winnerResponse.data.order;
  assert.equal(placed.price, 1800);
  assert.equal((await call('/orders', { cookie: winnerCookieForOrder })).data.orders.length, 1);
  assert.equal((await call('/orders', { cookie: otherCookie })).data.orders.length, 0);
  assert.equal((await call('/orders', { cookie: adminCookie })).data.orders.length, 1);

  const unavailableEdit = await call(`/paintings/${testPaintingId}`, {
    method: 'PATCH', cookie: adminCookie, body: { title: 'Edited after sale' }
  });
  assert.equal(unavailableEdit.response.status, 409);
  assert.equal((await call(`/orders/${placed.id}/cancel`, { method: 'PATCH', cookie: otherCookie })).response.status, 404);
  const cancelled = await call(`/orders/${placed.id}/cancel`, { method: 'PATCH', cookie: winnerCookieForOrder });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.data.order.status, 'cancelled');
  assert.equal((await call(`/paintings/${testPaintingId}`, { cookie: winnerCookieForOrder })).data.painting.available, true);
  assert.equal((await call(`/orders/${placed.id}/cancel`, { method: 'PATCH', cookie: winnerCookieForOrder })).response.status, 409);

  const tooEarly = await call('/bookings', {
    method: 'POST', cookie: firstCookie, body: { date: dateIn(6), wall_sqft: 10, address: 'Studio address' }
  });
  const tooLate = await call('/bookings', {
    method: 'POST', cookie: firstCookie, body: { date: dateIn(91), wall_sqft: 500, address: 'Studio address' }
  });
  assert.equal(tooEarly.response.status, 400);
  assert.equal(tooLate.response.status, 400);
  const bookingRace = await Promise.all([
    call('/bookings', { method: 'POST', cookie: firstCookie, body: { date: dateIn(8), wall_sqft: 24, address: 'First address' } }),
    call('/bookings', { method: 'POST', cookie: secondCookie, body: { date: dateIn(8), wall_sqft: 32, address: 'Second address' } })
  ]);
  assert.deepEqual(bookingRace.map(result => result.response.status).sort(), [201, 409]);
  assert.equal((await call('/bookings', {
    method: 'POST', cookie: firstCookie, body: { date: dateIn(8), wall_sqft: 9, address: 'Studio address' }
  })).response.status, 400);
  assert.equal((await call('/bookings', {
    method: 'POST', cookie: firstCookie, body: { date: dateIn(8), wall_sqft: 501, address: 'Studio address' }
  })).response.status, 400);
  const booking = await call('/bookings', {
    method: 'POST', cookie: firstCookie, body: { date: dateIn(7), wall_sqft: 10, address: '  Studio address  ' }
  });
  assert.equal(booking.response.status, 201);
  assert.equal(booking.data.booking.total_price, 10 * 75);
  const collision = await call('/bookings', {
    method: 'POST', cookie: secondCookie, body: { date: dateIn(7), wall_sqft: 500, address: 'Another address' }
  });
  assert.equal(collision.response.status, 409);
  assert.equal(collision.data.error.message, 'That date was just booked.');
  assert.equal((await call('/bookings/taken-dates', { cookie: firstCookie })).data.takenDates.includes(dateIn(7)), true);
  assert.equal((await call(`/bookings/${booking.data.booking.id}/confirm`, { method: 'PATCH', cookie: firstCookie })).response.status, 403);
  const maximumBooking = await call('/bookings', {
    method: 'POST', cookie: firstCookie, body: { date: dateIn(90), wall_sqft: 500, address: 'Maximum booking' }
  });
  assert.equal(maximumBooking.response.status, 201);
  assert.equal(maximumBooking.data.booking.total_price, 500 * 75);
  assert.equal((await call(`/bookings/${booking.data.booking.id}/confirm`, { method: 'PATCH', cookie: adminCookie })).data.booking.status, 'confirmed');

  const customerId = firstSignup.data.user.id;
  const cancelAtThree = db.prepare(`
    INSERT INTO wall_bookings (customer_id, date, wall_sqft, address, rate, total_price, status)
    VALUES (?, ?, 10, 'Cancellation boundary', 75, 750, 'confirmed')
  `).run(customerId, dateIn(3)).lastInsertRowid;
  assert.equal((await call(`/bookings/${cancelAtThree}/cancel`, { method: 'PATCH', cookie: firstCookie })).response.status, 200);
  const cancelAtTwo = db.prepare(`
    INSERT INTO wall_bookings (customer_id, date, wall_sqft, address, rate, total_price, status)
    VALUES (?, ?, 10, 'Too-late cancellation', 75, 750, 'requested')
  `).run(customerId, dateIn(2)).lastInsertRowid;
  assert.equal((await call(`/bookings/${cancelAtTwo}/cancel`, { method: 'PATCH', cookie: firstCookie })).response.status, 409);
  assert.equal((await call(`/bookings/${maximumBooking.data.booking.id}/cancel`, { method: 'PATCH', cookie: adminCookie })).response.status, 403);

  const invalidPottery = await call('/pottery', {
    method: 'POST', cookie: firstCookie, body: { item: 'Unknown', glaze: 'Unknown', quantity: 13, needed_by: dateIn(13) }
  });
  assert.equal(invalidPottery.response.status, 400);
  assert.equal((await call('/pottery', {
    method: 'POST', cookie: firstCookie, body: { item: 'Pouring Vessel', glaze: 'Ash Glaze', quantity: 13, needed_by: dateIn(14) }
  })).response.status, 400);
  assert.equal((await call('/pottery', {
    method: 'POST', cookie: firstCookie, body: { item: 'Pouring Vessel', glaze: 'Ash Glaze', quantity: 1, needed_by: dateIn(13) }
  })).response.status, 400);
  const pottery = await call('/pottery', {
    method: 'POST', cookie: firstCookie,
    body: { item: 'Pouring Vessel', glaze: 'Ash Glaze', quantity: 12, needed_by: dateIn(14) }
  });
  assert.equal(pottery.response.status, 201);
  assert.equal(pottery.data.request.status, 'requested');
  const accepted = await call(`/pottery/${pottery.data.request.id}/accept`, { method: 'PATCH', cookie: adminCookie });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.data.request.status, 'accepted');
  assert.equal((await call(`/pottery/${pottery.data.request.id}/cancel`, { method: 'PATCH', cookie: firstCookie })).response.status, 409);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM events WHERE entity_type = 'pottery_request'").get().count, 2);
});
