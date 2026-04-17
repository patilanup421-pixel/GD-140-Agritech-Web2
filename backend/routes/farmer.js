const express = require('express');
const router = express.Router();
const pool = require('../database/pool-sqlite');
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const { productValidation } = require('../middleware/validation');
const { upload, uploadToSupabaseStorage, deleteFromSupabaseStorage } = require('../utils/supabaseStorage');

// Create product with image upload
router.post('/product', 
  authMiddleware, 
  authorizeRole('farmer'),
  upload.single('image'),
  productValidation,
  async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { name, description, price, quantity, unit, category, image_url } = req.body;
      let imageUrl = image_url || null;
      // Upload image to Supabase Storage if provided
      if (req.file) {
        try {
          const uploadResult = await uploadToSupabaseStorage(req.file.buffer, req.file.mimetype, req.user.id);
          imageUrl = uploadResult.publicUrl;
        } catch (error) {
          await client.query('ROLLBACK');
          return res.status(500).json({
            success: false,
            message: 'Error uploading image',
            error: error.message
          });
        }
      }

      // Create product
      const result = await client.query(
        `INSERT INTO products (farmer_id, name, description, price, quantity, unit, category, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [req.user.id, name, description, price, quantity, unit || 'kg', category, imageUrl]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating product',
        error: error.message
      });
    } finally {
      client.release();
    }
  }
);

// Get farmer's products
router.get('/products', authMiddleware, authorizeRole('farmer'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE farmer_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

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

// Update product
router.put('/product/:id', 
  authMiddleware, 
  authorizeRole('farmer'),
  upload.single('image'),
  async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { name, description, price, quantity, unit, category, is_available } = req.body;

      // Check if product exists and belongs to farmer
      const productCheck = await client.query(
        'SELECT * FROM products WHERE id = $1 AND farmer_id = $2',
        [id, req.user.id]
      );

      if (productCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const existingProduct = productCheck.rows[0];
      let imageUrl = existingProduct.image_url;

      // Upload new image if provided
      if (req.file) {
        // Delete old image
        if (existingProduct.image_url) {
          await deleteFromSupabaseStorage(existingProduct.image_url);
        }
        
        const uploadResult = await uploadToSupabaseStorage(req.file.buffer, req.file.mimetype, req.user.id);
        imageUrl = uploadResult.publicUrl;
      }

      // Update product
      const result = await client.query(
        `UPDATE products 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             price = COALESCE($3, price),
             quantity = COALESCE($4, quantity),
             unit = COALESCE($5, unit),
             category = COALESCE($6, category),
             is_available = COALESCE($7, is_available),
             image_url = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 AND farmer_id = $10
         RETURNING *`,
        [name, description, price, quantity, unit, category, is_available, imageUrl, id, req.user.id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating product',
        error: error.message
      });
    } finally {
      client.release();
    }
  }
);

// Delete product
router.delete('/product/:id', authMiddleware, authorizeRole('farmer'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists and belongs to farmer
    const productCheck = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND farmer_id = $2',
      [id, req.user.id]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete image from Supabase Storage
    if (productCheck.rows[0].image_url) {
      await deleteFromSupabaseStorage(productCheck.rows[0].image_url);
    }

    // Delete product
    await pool.query('DELETE FROM products WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

// Get farmer's orders with buyer location details
router.get('/orders', authMiddleware, authorizeRole('farmer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        o.id,
        o.quantity,
        o.total_price,
        o.status,
        o.created_at,
        o.updated_at,
        o.buyer_address,
        o.buyer_latitude,
        o.buyer_longitude,
        b.name as buyer_name,
        b.email as buyer_email,
        p.id as product_id,
        p.name as product_name,
        p.image_url as product_image,
        p.price as product_price
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN buyers b ON o.buyer_id = b.id
      WHERE p.farmer_id = $1
      ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    const data = result.rows.map((order) => ({
      ...order,
      maps_url: order.buyer_latitude && order.buyer_longitude
        ? `https://www.google.com/maps?q=${order.buyer_latitude},${order.buyer_longitude}`
        : null
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get farmer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching farmer orders',
      error: error.message
    });
  }
});

// Get farmer dashboard summary
router.get('/summary', authMiddleware, authorizeRole('farmer'), async (req, res) => {
  try {
    const farmerId = req.user.id;

    const [productsResult, ordersResult] = await Promise.all([
      pool.query(
        'SELECT COUNT(*)::int as total_products FROM products WHERE farmer_id = $1',
        [farmerId]
      ),
      pool.query(
        `SELECT
          COUNT(*)::int as total_orders,
          COALESCE(SUM(o.total_price), 0)::numeric as total_revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.farmer_id = $1 AND o.status != $2`,
        [farmerId, 'cancelled']
      )
    ]);

    res.json({
      success: true,
      data: {
        total_products: productsResult.rows[0].total_products,
        total_orders: ordersResult.rows[0].total_orders,
        total_revenue: parseFloat(ordersResult.rows[0].total_revenue)
      }
    });
  } catch (error) {
    console.error('Get farmer summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching farmer summary',
      error: error.message
    });
  }
});
// Get farmer profile
router.get('/profile', authMiddleware, authorizeRole('farmer'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, farm_name, farm_address, phone, created_at, updated_at FROM farmers WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
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

module.exports = router;
