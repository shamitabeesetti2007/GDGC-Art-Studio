require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Initialize database (creates tables if needed)
require('./db/init');
const { seedPaintings } = require('./seed');
seedPaintings();

const authRoutes = require('./routes/auth');
const metaRoutes = require('./routes/meta');
const paintingsRoutes = require('./routes/paintings');
const ordersRoutes = require('./routes/orders');
const bookingsRoutes = require('./routes/bookings');
const potteryRoutes = require('./routes/pottery');
const { errorHandler, notFoundHandler } = require('./middleware/error');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/config.js', (req, res) => {
  res.type('application/javascript').send(
    `window.ART_API_BASE_URL = ${JSON.stringify(process.env.FRONTEND_API_URL || '')};`
  );
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/paintings', paintingsRoutes);
app.use('/api', ordersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/pottery', potteryRoutes);

// Serve index.html for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  }
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Hauser&Wirth server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
