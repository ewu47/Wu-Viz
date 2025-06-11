const express = require('express');
const cors = require('cors');
require('dotenv').config();

const divvyRoutes = require('./routes/divvy');
const databaseRoutes = require('./routes/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/divvy', divvyRoutes);
app.use('/api/database', databaseRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// For Vercel deployment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
