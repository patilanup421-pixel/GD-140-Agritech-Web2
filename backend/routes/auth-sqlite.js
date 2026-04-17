const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/pool-sqlite');
const { signupValidation, loginValidation } = require('../middleware/validation');
const { generateToken } = require('../utils/token');
const { v4: uuidv4 } = require('uuid');

// Signup
router.post('/signup', signupValidation, async (req, res) => {
  try {
    const { email, password, name, role, address, latitude, longitude } = req.body;

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = uuidv4();

    // Create user
    db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(
      userId, email, hashedPassword, role
    );

    // Create role-specific profile
    if (role === 'buyer') {
      db.prepare('INSERT INTO buyers (id, name, email, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)').run(
        userId, name, email, address || null, latitude || null, longitude || null
      );
    } else if (role === 'farmer') {
      db.prepare('INSERT INTO farmers (id, name, email) VALUES (?, ?, ?)').run(
        userId, name, email
      );
    }

    // Generate token
    const token = generateToken({ id: userId, email, role });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: userId,
          email,
          role,
          name,
          address,
          latitude,
          longitude
        },
        token
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
});

// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

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
      profileData = db.prepare('SELECT name, address, latitude, longitude FROM buyers WHERE id = ?').get(user.id) || {};
    } else if (user.role === 'farmer') {
      profileData = db.prepare('SELECT name, farm_name, farm_address, phone FROM farmers WHERE id = ?').get(user.id) || {};
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
