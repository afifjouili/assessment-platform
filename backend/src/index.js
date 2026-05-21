require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const { initializeDatabase } = require('./db/database');
const { seedDatabase } = require('./db/seed');

// Import routes
const authRoutes = require('./routes/auth');
const assessmentRoutes = require('./routes/assessments');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Initialize DB asynchronously, seed data, then start server
async function startServer() {
  try {
    await initializeDatabase();
    seedDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`CORS enabled for http://localhost:3000`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
