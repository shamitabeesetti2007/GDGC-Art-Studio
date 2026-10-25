const express = require('express');
const db = require('../db/init');
const { authRequired, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function paintingWithAvailability(row) {
  const hasPlacedOrder = db.prepare(
    `SELECT COUNT(*) as cnt FROM orders WHERE painting_id = ? AND status = 'placed'`
  ).get(row.id).cnt > 0;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    description: row.description,
    price: row.price,
    image_url: row.image_url,
    available: !hasPlacedOrder,
    created_at: row.created_at
  };
}

// GET /api/paintings
router.get('/', authRequired, (req, res) => {
  const paintings = db.prepare('SELECT * FROM paintings ORDER BY id DESC').all();
  res.json({ paintings: paintings.map(paintingWithAvailability) });
});

// GET /api/paintings/:id
router.get('/:id', authRequired, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(id);
  if (!painting) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Painting not found.' }
    });
  }
  res.json({ painting: paintingWithAvailability(painting) });
});

// POST /api/paintings — admin only
router.post('/', authRequired, requireAdmin, (req, res) => {
  const { title, artist, description, price, image_url } = req.body || {};

  if (![title, artist, description].every(value => typeof value === 'string' && value.trim()) || price === undefined) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Title, artist, description, and price are required.' }
    });
  }

  if (!Number.isInteger(price) || price <= 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Price must be a positive integer.' }
    });
  }

  const result = db.prepare(
    'INSERT INTO paintings (title, artist, description, price, image_url) VALUES (?, ?, ?, ?, ?)'
  ).run(title.trim(), artist.trim(), description.trim(), price, typeof image_url === 'string' ? image_url.trim() : '');

  const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ painting: paintingWithAvailability(painting) });
});

// PATCH /api/paintings/:id — admin only
router.patch('/:id', authRequired, requireAdmin, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
  const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(id);
  if (!painting) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Painting not found.' }
    });
  }

  // Check availability — admins can only edit available paintings
  const hasPlacedOrder = db.prepare(
    `SELECT COUNT(*) as cnt FROM orders WHERE painting_id = ? AND status = 'placed'`
  ).get(painting.id).cnt > 0;

  if (hasPlacedOrder) {
    return res.status(409).json({
      error: { code: 'PAINTING_UNAVAILABLE', message: 'This painting has been sold and cannot be edited.' }
    });
  }

  const { title, artist, description, price, image_url } = req.body || {};

  for (const [field, value] of Object.entries({ title, artist, description })) {
    if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: `${field} cannot be empty.` }
      });
    }
  }
  if (price !== undefined && (!Number.isInteger(price) || price <= 0)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Price must be a positive integer.' }
    });
  }
  if (image_url !== undefined && typeof image_url !== 'string') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Image URL must be text.' }
    });
  }

  db.prepare(`
    UPDATE paintings SET
      title = COALESCE(?, title),
      artist = COALESCE(?, artist),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).run(title === undefined ? null : title.trim(), artist === undefined ? null : artist.trim(),
    description === undefined ? null : description.trim(), price === undefined ? null : price,
    image_url === undefined ? null : image_url.trim(), painting.id);

  const updated = db.prepare('SELECT * FROM paintings WHERE id = ?').get(painting.id);
  res.json({ painting: paintingWithAvailability(updated) });
});

module.exports = router;
