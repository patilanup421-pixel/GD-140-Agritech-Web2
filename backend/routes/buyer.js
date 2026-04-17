const express = require('express');
const router = express.Router();
const pool = require('../database/pool-sqlite');
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const { buyerProfileValidation } = require('../middleware/validation');

// Get buyer profile
router.get('/profile', authMiddleware, authorizeRole('buyer'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, address, latitude, longitude, created_at, updated_at FROM buyers WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

// Update buyer profile
router.put('/profile', authMiddleware, authorizeRole('buyer'), buyerProfileValidation, async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    if (address !== undefined) {
      updates.push(`address = $${paramCount}`);
      values.push(address);
      paramCount++;
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${paramCount}`);
      values.push(latitude);
      paramCount++;
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${paramCount}`);
      values.push(longitude);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.user.id);

    const result = await pool.query(
      `UPDATE buyers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, address, latitude, longitude, updated_at`,
      values
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// Get buyer's orders
router.get('/orders', authMiddleware, authorizeRole('buyer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        o.id,
        o.quantity,
        o.total_price,
        o.status,
        o.buyer_address,
        o.notes,
        o.created_at,
        p.name as product_name,
        p.image_url as product_image,
        p.price as product_price,
        f.name as farmer_name,
        f.farm_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN farmers f ON o.farmer_id = f.id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

module.exports = router;
