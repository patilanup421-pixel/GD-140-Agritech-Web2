const express = require('express');
const router = express.Router();
const pool = require('../database/pool-sqlite');
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const { orderValidation, updateOrderStatusValidation } = require('../middleware/validation');

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if order exists and belongs to farmer
    const orderCheck = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND farmer_id = $2',
      [id, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderCheck.rows[0];

    // Update order status
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.to(`buyer_${order.buyer_id}`).emit('order_status_update', {
        order_id: order.id,
        status: status,
        product_name: order.product_id
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
};

// Place order (Buyer)
router.post('/', authMiddleware, authorizeRole('buyer'), orderValidation, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { product_id, quantity, buyer_address, buyer_latitude, buyer_longitude, notes } = req.body;

    // Get product details
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 AND is_available = true',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Product not found or not available'
      });
    }

    const product = productResult.rows[0];

    // Check if sufficient quantity is available
    if (product.quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} ${product.unit} available`
      });
    }

    // Get buyer details
    const buyerResult = await client.query(
      'SELECT * FROM buyers WHERE id = $1',
      [req.user.id]
    );

    const buyer = buyerResult.rows[0];

    // Calculate total price
    const totalPrice = (parseFloat(product.price) * parseFloat(quantity)).toFixed(2);

    // Use provided address/location or fallback to buyer's profile
    const finalAddress = buyer_address || buyer.address;
    const finalLatitude = buyer_latitude || buyer.latitude;
    const finalLongitude = buyer_longitude || buyer.longitude;

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (buyer_id, product_id, farmer_id, quantity, total_price, buyer_address, buyer_latitude, buyer_longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, product_id, product.farmer_id, quantity, totalPrice, finalAddress, finalLatitude, finalLongitude, notes]
    );

    // Update product quantity
    await client.query(
      'UPDATE products SET quantity = quantity - $1 WHERE id = $2',
      [quantity, product_id]
    );

    await client.query('COMMIT');

    const order = orderResult.rows[0];

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.to(`farmer_${product.farmer_id}`).emit('new_order', {
        order_id: order.id,
        product_name: product.name,
        quantity: quantity,
        total_price: totalPrice,
        buyer_name: buyer.name
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Place order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error placing order',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get orders for farmer
router.get('/farmer', authMiddleware, authorizeRole('farmer'), async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        o.id,
        o.quantity,
        o.total_price,
        o.status,
        o.buyer_address,
        o.buyer_latitude,
        o.buyer_longitude,
        o.notes,
        o.created_at,
        o.updated_at,
        b.name as buyer_name,
        b.email as buyer_email,
        p.name as product_name,
        p.image_url as product_image,
        p.price as product_price
      FROM orders o
      JOIN buyers b ON o.buyer_id = b.id
      JOIN products p ON o.product_id = p.id
      WHERE o.farmer_id = $1
    `;
    
    const queryParams = [req.user.id];

    if (status) {
      query += ' AND o.status = $2';
      queryParams.push(status);
    }

    query += ' ORDER BY o.created_at DESC';

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get farmer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Update order status (Farmer)
router.put('/:id/status', authMiddleware, authorizeRole('farmer'), updateOrderStatusValidation, updateOrderStatus);

// Update order status (Farmer) - PATCH alias for simplified client contract
router.patch('/:id', authMiddleware, authorizeRole('farmer'), updateOrderStatusValidation, updateOrderStatus);

// Get all products (for buyers to browse)
router.get('/products', async (req, res) => {
  try {
    const { category, min_price, max_price, available } = req.query;

    let query = `
      SELECT 
        p.*,
        f.name as farmer_name,
        f.farm_name
      FROM products p
      JOIN farmers f ON p.farmer_id = f.id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 1;

    if (category) {
      query += ` AND p.category = $${paramCount}`;
      queryParams.push(category);
      paramCount++;
    }

    if (min_price) {
      query += ` AND p.price >= $${paramCount}`;
      queryParams.push(min_price);
      paramCount++;
    }

    if (max_price) {
      query += ` AND p.price <= $${paramCount}`;
      queryParams.push(max_price);
      paramCount++;
    }

    if (available === 'true') {
      query += ` AND p.is_available = true AND p.quantity > 0`;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// Get order details (with location for map)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        o.*,
        b.name as buyer_name,
        b.email as buyer_email,
        f.name as farmer_name,
        f.farm_name,
        p.name as product_name,
        p.description as product_description,
        p.image_url as product_image
      FROM orders o
      JOIN buyers b ON o.buyer_id = b.id
      JOIN farmers f ON o.farmer_id = f.id
      JOIN products p ON o.product_id = p.id
      WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = result.rows[0];

    // Check authorization
    if (req.user.role === 'buyer' && order.buyer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'farmer' && order.farmer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate Google Maps URL
    const mapsUrl = order.buyer_latitude && order.buyer_longitude
      ? `https://www.google.com/maps?q=${order.buyer_latitude},${order.buyer_longitude}`
      : null;

    res.json({
      success: true,
      data: {
        ...order,
        maps_url: mapsUrl
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

module.exports = router;
