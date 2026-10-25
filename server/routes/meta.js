const express = require('express');
const { wallPaintingRate, potteryItems, glazes } = require('../seed');
const { today } = require('../utils/dates');

const router = express.Router();

// GET /api/meta — no auth required
router.get('/', (req, res) => {
  res.json({
    meta: {
      wallPainting: {
        ratePerSqft: wallPaintingRate,
        today: today(),
        minSqft: 10,
        maxSqft: 500,
        minDaysAhead: 7,
        maxDaysAhead: 90,
        cancelMinDaysAhead: 3
      },
      pottery: {
        items: potteryItems,
        glazes: glazes,
        today: today(),
        minQuantity: 1,
        maxQuantity: 12,
        minDaysAhead: 14
      }
    }
  });
});

module.exports = router;
