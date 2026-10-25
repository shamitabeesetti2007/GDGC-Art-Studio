const express = require('express');
const db = require('../db/init');
const { authRequired, requireCustomer, requireAdmin } = require('../middleware/auth');
const { wallPaintingRate } = require('../seed');
const { isDateOnly, daysFromToday } = require('../utils/dates');

const router = express.Router();

// Shared today helper using Asia/Kolkata
function bookingWithCustomer(row) {
  return {
    id: row.id,
    customer_id: row.customer_id,
    customer_name: row.customer_name || null,
    date: row.date,
    wall_sqft: row.wall_sqft,
    address: row.address,
    rate: row.rate,
    total_price: row.total_price,
    status: row.status,
    created_at: row.created_at
  };
}

class DoubleBookingError extends Error {}

// GET /api/bookings/taken-dates
router.get('/taken-dates', authRequired, (req, res) => {
  const dates = db.prepare(
    "SELECT date FROM wall_bookings WHERE status IN ('requested', 'confirmed') ORDER BY date"
  ).all();
  res.json({ takenDates: dates.map(d => d.date) });
});

// POST /api/bookings
router.post('/', authRequired, requireCustomer, (req, res) => {
  const { date, wall_sqft, address } = req.body || {};

  if (!date || wall_sqft === undefined || typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Date, wall area, and address are required.' }
    });
  }

  const sqft = wall_sqft;
  if (!Number.isInteger(sqft) || sqft < 10 || sqft > 500) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Wall area must be between 10 and 500 square feet.' }
    });
  }

  if (!isDateOnly(date)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Booking date must be a valid date in YYYY-MM-DD format.' }
    });
  }
  const daysAhead = daysFromToday(date);
  if (daysAhead < 7 || daysAhead > 90) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Booking date must be between 7 and 90 days from today.' }
    });
  }

  const totalPrice = sqft * wallPaintingRate;

  const insertBooking = db.transaction(() => {
    try {
      const result = db.prepare(`
        INSERT INTO wall_bookings (customer_id, date, wall_sqft, address, rate, total_price, status)
        VALUES (?, ?, ?, ?, ?, ?, 'requested')
      `).run(req.user.id, date, sqft, address.trim(), wallPaintingRate, totalPrice);

      db.prepare(`
        INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
        VALUES ('wall_booking', ?, NULL, 'requested', ?)
      `).run(result.lastInsertRowid, req.user.id);

      const booking = db.prepare('SELECT * FROM wall_bookings WHERE id = ?').get(result.lastInsertRowid);
      return booking;
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        throw new DoubleBookingError();
      }
      throw err;
    }
  });

  try {
    const booking = insertBooking();
    const result = bookingWithCustomer(booking);
    res.status(201).json({ booking: result });
  } catch (err) {
    if (err instanceof DoubleBookingError) {
      return res.status(409).json({
        error: { code: 'DOUBLE_BOOKING', message: 'That date was just booked.' }
      });
    }
    throw err;
  }
});

// GET /api/bookings
router.get('/', authRequired, (req, res) => {
  let bookings;
  if (req.user.role === 'admin') {
    bookings = db.prepare(`
      SELECT wb.*, u.name as customer_name
      FROM wall_bookings wb
      JOIN users u ON wb.customer_id = u.id
      ORDER BY wb.date DESC
    `).all();
  } else {
    bookings = db.prepare('SELECT * FROM wall_bookings WHERE customer_id = ? ORDER BY date DESC').all(req.user.id);
  }
  res.json({ bookings: bookings.map(bookingWithCustomer) });
});

// PATCH /api/bookings/:id/confirm — admin only
router.patch('/:id/confirm', authRequired, requireAdmin, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const booking = db.prepare('SELECT * FROM wall_bookings WHERE id = ?').get(id);

  if (!booking) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Booking not found.' }
    });
  }

  if (booking.status !== 'requested') {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'Only requested bookings can be confirmed.' }
    });
  }

  const transition = db.transaction(() => {
    const changed = db.prepare("UPDATE wall_bookings SET status = 'confirmed' WHERE id = ? AND status = 'requested'").run(id);
    if (changed.changes !== 1) return false;
    db.prepare(`
      INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
      VALUES ('wall_booking', ?, 'requested', 'confirmed', ?)
    `).run(id, req.user.id);
    return true;
  });
  if (!transition()) return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'Only requested bookings can be confirmed.' } });

  const updated = db.prepare('SELECT * FROM wall_bookings WHERE id = ?').get(id);
  res.json({ booking: bookingWithCustomer(updated) });
});

// PATCH /api/bookings/:id/decline — admin only
router.patch('/:id/decline', authRequired, requireAdmin, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const booking = db.prepare('SELECT * FROM wall_bookings WHERE id = ?').get(id);

  if (!booking) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Booking not found.' }
    });
  }

  if (booking.status !== 'requested') {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'Only requested bookings can be declined.' }
    });
  }

  const transition = db.transaction(() => {
    const changed = db.prepare("UPDATE wall_bookings SET status = 'declined' WHERE id = ? AND status = 'requested'").run(id);
    if (changed.changes !== 1) return false;
    db.prepare(`
      INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
      VALUES ('wall_booking', ?, 'requested', 'declined', ?)
    `).run(id, req.user.id);
    return true;
  });
  if (!transition()) return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'Only requested bookings can be declined.' } });

  const updated = db.prepare('SELECT * FROM wall_bookings WHERE id = ?').get(id);
  res.json({ booking: bookingWithCustomer(updated) });
});

// PATCH /api/bookings/:id/cancel — customer only
router.patch('/:id/cancel', authRequired, requireCustomer, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const booking = db.prepare('SELECT * FROM wall_bookings WHERE id = ?').get(id);

  if (!booking) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Booking not found.' }
    });
  }

  if (booking.customer_id !== req.user.id) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Booking not found.' }
    });
  }

  if (!['requested', 'confirmed'].includes(booking.status)) {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'This booking cannot be cancelled.' }
    });
  }

  const daysAhead = daysFromToday(booking.date);
  if (daysAhead < 3) {
    return res.status(409).json({
      error: { code: 'TOO_LATE', message: 'Bookings can only be cancelled at least 3 days before the date.' }
    });
  }

  const oldStatus = booking.status;
  const cancel = db.transaction(() => {
    const changed = db.prepare(`
      UPDATE wall_bookings SET status = 'cancelled'
      WHERE id = ? AND customer_id = ? AND status = ?
    `).run(id, req.user.id, oldStatus);
    if (changed.changes !== 1) return false;
    db.prepare(`
      INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
      VALUES ('wall_booking', ?, ?, 'cancelled', ?)
    `).run(id, oldStatus, req.user.id);
    return true;
  });
  if (!cancel()) return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'This booking cannot be cancelled.' } });

  const updated = db.prepare('SELECT * FROM wall_bookings WHERE id = ?').get(id);
  res.json({ booking: bookingWithCustomer(updated) });
});

module.exports = router;
