const express = require('express');
const db = require('../db/init');
const { authRequired, requireCustomer } = require('../middleware/auth');

const router = express.Router();

function orderWithPainting(row) {
  const painting = db.prepare('SELECT id, title, artist, image_url FROM paintings WHERE id = ?').get(row.painting_id);
  return {
    id: row.id,
    painting_id: row.painting_id,
    painting: painting ? {
      id: painting.id,
      title: painting.title,
      artist: painting.artist,
      image_url: painting.image_url
    } : null,
    price: row.price,
    status: row.status,
    created_at: row.created_at,
    cancelled_at: row.cancelled_at
  };
}

// GET /api/orders
router.get('/orders', authRequired, (req, res) => {
  let orders;
  if (req.user.role === 'admin') {
    orders = db.prepare(`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN users u ON o.customer_id = u.id
      ORDER BY o.created_at DESC
    `).all();
  } else {
    orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(req.user.id);
  }

  const result = orders.map(row => {
    const order = orderWithPainting(row);
    if (req.user.role === 'admin') {
      order.customer_id = row.customer_id;
      order.customer_name = row.customer_name;
      order.customer_email = row.customer_email;
    }
    return order;
  });

  res.json({ orders: result });
});

// POST /api/paintings/:id/orders
router.post('/paintings/:paintingId/orders', authRequired, requireCustomer, (req, res) => {
  const paintingId = /^\d+$/.test(req.params.paintingId) ? Number(req.params.paintingId) : NaN;
  if (!Number.isSafeInteger(paintingId) || paintingId < 1) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid painting ID.' }
    });
  }

  // Serialize the availability check and price snapshot with the insert.
  const insertOrder = db.transaction(() => {
    const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(paintingId);
    if (!painting) throw new PaintingNotFoundError();
    try {
      const result = db.prepare(`
        INSERT INTO orders (customer_id, painting_id, price, status)
        VALUES (?, ?, ?, 'placed')
      `).run(req.user.id, paintingId, painting.price);

      // Record event
      db.prepare(`
        INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
        VALUES ('order', ?, NULL, 'placed', ?)
      `).run(result.lastInsertRowid, req.user.id);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
      return orderWithPainting(order);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        throw new DoubleSellError();
      }
      throw err;
    }
  });

  try {
    const order = insertOrder.immediate();
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof PaintingNotFoundError) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Painting not found.' }
      });
    }
    if (err instanceof DoubleSellError) {
      return res.status(409).json({
        error: { code: 'DOUBLE_SELL', message: 'Someone just bought this painting.' }
      });
    }
    throw err;
  }
});

// PATCH /api/orders/:id/cancel
router.patch('/orders/:id/cancel', authRequired, requireCustomer, (req, res) => {
  const orderId = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid order ID.' }
    });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Order not found.' }
    });
  }

  // Customers can only cancel their own orders
  if (order.customer_id !== req.user.id) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Order not found.' }
    });
  }

  if (order.status !== 'placed') {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'This order cannot be cancelled.' }
    });
  }

  const cancel = db.transaction(() => {
    const changed = db.prepare(`
      UPDATE orders SET status = 'cancelled', cancelled_at = datetime('now')
      WHERE id = ? AND customer_id = ? AND status = 'placed'
    `).run(orderId, req.user.id);
    if (changed.changes !== 1) return false;
    db.prepare(`
      INSERT INTO events (entity_type, entity_id, from_status, to_status, actor_id)
      VALUES ('order', ?, 'placed', 'cancelled', ?)
    `).run(orderId, req.user.id);
    return true;
  });
  if (!cancel()) {
    return res.status(409).json({
      error: { code: 'INVALID_TRANSITION', message: 'This order cannot be cancelled.' }
    });
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({ order: orderWithPainting(updated) });
});

class DoubleSellError extends Error {
  constructor() {
    super('double sell');
  }
}

class PaintingNotFoundError extends Error {}

module.exports = router;
