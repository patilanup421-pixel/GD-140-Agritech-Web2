const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../database/pool-sqlite');
const { signupValidation, loginValidation } = require('../middleware/validation');
const { generateToken } = require('../utils/token');

// Signup
router.post('/signup', signupValidation, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password, name, role, address, latitude, longitude } = req.body;

    await client.query('BEGIN');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userResult = await client.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, role]
    );

    const user = userResult.rows[0];

    // Create role-specific profile
    if (role === 'buyer') {
      await client.query(
        'INSERT INTO buyers (id, name, email, address, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.id, name, email, address || null, latitude || null, longitude || null]
      );
    } else if (role === 'farmer') {
      await client.query(
        'INSERT INTO farmers (id, name, email, farm_address) VALUES ($1, $2, $3, $4)',
        [user.id, name, email, address || null]
      );
    }

    await client.query('COMMIT');

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: name,
          ...(role === 'buyer' ? {
            address: address || null,
            latitude: latitude || null,
            longitude: longitude || null
          } : {})
        },
        token
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Get role-specific data
    let profileData = {};
    if (user.role === 'buyer') {
      const buyerResult = await pool.query(
        'SELECT name, address, latitude, longitude FROM buyers WHERE id = $1',
        [user.id]
      );
      profileData = buyerResult.rows[0] || {};
    } else if (user.role === 'farmer') {
      const farmerResult = await pool.query(
        'SELECT name, farm_name, farm_address, phone FROM farmers WHERE id = $1',
        [user.id]
      );
      profileData = farmerResult.rows[0] || {};
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          ...profileData
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

module.exports = router;
