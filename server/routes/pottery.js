const express = require('express');
const db = require('../db/init');
const { authRequired, requireCustomer, requireAdmin } = require('../middleware/auth');
const { potteryItems, glazes } = require('../seed');
const { isDateOnly, daysFromToday } = require('../utils/dates');

const router = express.Router();

function potteryWithCustomer(row) {
  return {
    id: row.id,
    customer_id: row.customer_id,
    customer_name: row.customer_name || null,
    item: row.item,
    glaze: row.glaze,
    quantity: row.quantity,
    needed_by: row.needed_by,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function recordTransition(id, from, to, actorId) {
  const transition = db.transaction(() => {
    const changed = db.prepare(`
      UPDATE pottery_requests SET status = ?, updated_at = datetime('now')
      WHERE id = ? AND status = ?
    `).run(to, id, from);
    if (changed.changes !== 1) return false;
    db.prepare(`
      INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
      VALUES ('pottery_request', ?, ?, ?, ?)
    `).run(id, from, to, actorId);
    return true;
  });
  return transition();
}

function validateRequest(item, glaze, quantity, neededBy, res) {
  if (!potteryItems.includes(item)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid pottery item selected.' } });
    return false;
  }
  if (!glazes.some(option => option.name === glaze)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid glaze selected.' } });
    return false;
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 12) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Quantity must be between 1 and 12.' } });
    return false;
  }
  if (!isDateOnly(neededBy) || daysFromToday(neededBy) < 14) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Needed-by date must be at least 14 days from today.' } });
    return false;
  }
  return true;
}

// POST /api/pottery
router.post('/', authRequired, requireCustomer, (req, res) => {
  const { item, glaze, quantity, needed_by } = req.body || {};

  if (!item || !glaze || !quantity || !needed_by) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Item, glaze, quantity, and needed-by date are required.' }
    });
  }

  if (!validateRequest(item, glaze, quantity, needed_by, res)) return;
  const create = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO pottery_requests (customer_id, item, glaze, quantity, needed_by, status)
      VALUES (?, ?, ?, ?, ?, 'requested')
    `).run(req.user.id, item, glaze, quantity, needed_by);
    db.prepare(`
      INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
      VALUES ('pottery_request', ?, NULL, 'requested', ?)
    `).run(result.lastInsertRowid, req.user.id);
    return db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(result.lastInsertRowid);
  });
  res.status(201).json({ request: potteryWithCustomer(create()) });
});

// GET /api/pottery
router.get('/', authRequired, (req, res) => {
  let pottery;
  if (req.user.role === 'admin') {
    pottery = db.prepare(`
      SELECT pr.*, u.name as customer_name
      FROM pottery_requests pr
      JOIN users u ON pr.customer_id = u.id
      ORDER BY pr.created_at DESC
    `).all();
  } else {
    pottery = db.prepare('SELECT * FROM pottery_requests WHERE customer_id = ? ORDER BY created_at DESC').all(req.user.id);
  }
  res.json({ requests: pottery.map(potteryWithCustomer) });
});

// PATCH /api/pottery/:id — customer edit
router.patch('/:id', authRequired, requireCustomer, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const pottery = db.prepare('SELECT * FROM pottery_requests WHERE id = ? AND customer_id = ?').get(id, req.user.id);

  if (!pottery) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Pottery request not found.' }
    });
  }

  if (pottery.status !== 'requested') {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'Only requested pottery can be edited.' }
    });
  }

  const body = req.body || {};
  const item = body.item === undefined ? pottery.item : body.item;
  const glaze = body.glaze === undefined ? pottery.glaze : body.glaze;
  const quantity = body.quantity === undefined ? pottery.quantity : body.quantity;
  const needed_by = body.needed_by === undefined ? pottery.needed_by : body.needed_by;
  if (!validateRequest(item, glaze, quantity, needed_by, res)) return;

  db.prepare(`
    UPDATE pottery_requests SET item = ?, glaze = ?, quantity = ?, needed_by = ?, updated_at = datetime('now') WHERE id = ?
  `).run(item, glaze, quantity, needed_by, id);

  const updated = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(id);
  res.json({ request: potteryWithCustomer(updated) });
});

// PATCH /api/pottery/:id/accept — admin only
router.patch('/:id/accept', authRequired, requireAdmin, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const pottery = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(id);

  if (!pottery) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Pottery request not found.' }
    });
  }

  if (pottery.status !== 'requested') {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'Only requested pottery can be accepted.' }
    });
  }

  if (!recordTransition(id, 'requested', 'accepted', req.user.id)) {
    return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'Only requested pottery can be accepted.' } });
  }

  const updated = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(id);
  res.json({ request: potteryWithCustomer(updated) });
});

// PATCH /api/pottery/:id/decline — admin only
router.patch('/:id/decline', authRequired, requireAdmin, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const pottery = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(id);

  if (!pottery) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Pottery request not found.' }
    });
  }

  if (pottery.status !== 'requested') {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'Only requested pottery can be declined.' }
    });
  }

  if (!recordTransition(id, 'requested', 'declined', req.user.id)) {
    return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'Only requested pottery can be declined.' } });
  }

  const updated = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(id);
  res.json({ request: potteryWithCustomer(updated) });
});

// PATCH /api/pottery/:id/cancel — customer only
router.patch('/:id/cancel', authRequired, requireCustomer, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const pottery = db.prepare('SELECT * FROM pottery_requests WHERE id = ? AND customer_id = ?').get(id, req.user.id);

  if (!pottery) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Pottery request not found.' }
    });
  }

  if (pottery.status !== 'requested') {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'Only requested pottery can be cancelled.' }
    });
  }

  if (!recordTransition(id, 'requested', 'cancelled', req.user.id)) {
    return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'Only requested pottery can be cancelled.' } });
  }

  const updated = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(id);
  res.json({ request: potteryWithCustomer(updated) });
});

module.exports = router;
