const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// Get all tables in the database
router.get('/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    res.json({
      success: true,
      data: result.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tables',
      error: error.message
    });
  }
});

// Get columns for a specific table
router.get('/tables/:tableName/columns', async (req, res) => {
  try {
    const { tableName } = req.params;
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching columns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch columns',
      error: error.message
    });
  }
});

// Get data from a specific table
router.get('/tables/:tableName/data', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    // Sanitize table name to prevent SQL injection
    const validTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    const result = await pool.query(`
      SELECT * FROM "${validTableName}" 
      ORDER BY 1 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) FROM "${validTableName}"`);
    
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table data',
      error: error.message
    });
  }
});

module.exports = router;
