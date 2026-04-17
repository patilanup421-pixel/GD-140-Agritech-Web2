const express = require('express');
const router = express.Router();
const pool = require('../database/pool-sqlite');
const { authMiddleware, authorizeRole } = require('../middleware/auth');

// Get farmer analytics dashboard
router.get('/dashboard', authMiddleware, authorizeRole('farmer'), async (req, res) => {
  try {
    const farmerId = req.user.id;

    // Total orders
    const totalOrdersResult = await pool.query(
      'SELECT COUNT(*) as total_orders FROM orders WHERE farmer_id = $1',
      [farmerId]
    );

    // Total revenue
    const totalRevenueResult = await pool.query(
      'SELECT COALESCE(SUM(total_price), 0) as total_revenue FROM orders WHERE farmer_id = $1 AND status != $2',
      [farmerId, 'cancelled']
    );

    // Orders by status
    const ordersByStatusResult = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM orders 
       WHERE farmer_id = $1 
       GROUP BY status`,
      [farmerId]
    );

    // Top selling products
    const topProductsResult = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.image_url,
        SUM(o.quantity) as total_sold,
        SUM(o.total_price) as total_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.farmer_id = $1 AND o.status != $2
      GROUP BY p.id, p.name, p.image_url
      ORDER BY total_sold DESC
      LIMIT 10`,
      [farmerId, 'cancelled']
    );

    // Recent orders (last 5)
    const recentOrdersResult = await pool.query(
      `SELECT 
        o.id,
        o.quantity,
        o.total_price,
        o.status,
        o.created_at,
        b.name as buyer_name,
        p.name as product_name
      FROM orders o
      JOIN buyers b ON o.buyer_id = b.id
      JOIN products p ON o.product_id = p.id
      WHERE o.farmer_id = $1
      ORDER BY o.created_at DESC
      LIMIT 5`,
      [farmerId]
    );

    // Revenue by month (last 6 months)
    const revenueByMonthResult = await pool.query(
      `SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as orders_count,
        SUM(total_price) as monthly_revenue
      FROM orders
      WHERE farmer_id = $1 AND status != $2
      AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC`,
      [farmerId, 'cancelled']
    );

    res.json({
      success: true,
      data: {
        overview: {
          total_orders: parseInt(totalOrdersResult.rows[0].total_orders),
          total_revenue: parseFloat(totalRevenueResult.rows[0].total_revenue)
        },
        orders_by_status: ordersByStatusResult.rows,
        top_products: topProductsResult.rows,
        recent_orders: recentOrdersResult.rows,
        revenue_by_month: revenueByMonthResult.rows
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
});

// Get buyer analytics (optional)
router.get('/buyer-stats', authMiddleware, authorizeRole('buyer'), async (req, res) => {
  try {
    const buyerId = req.user.id;

    // Total orders
    const totalOrdersResult = await pool.query(
      'SELECT COUNT(*) as total_orders FROM orders WHERE buyer_id = $1',
      [buyerId]
    );

    // Total spent
    const totalSpentResult = await pool.query(
      'SELECT COALESCE(SUM(total_price), 0) as total_spent FROM orders WHERE buyer_id = $1 AND status != $2',
      [buyerId, 'cancelled']
    );

    // Orders by status
    const ordersByStatusResult = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM orders 
       WHERE buyer_id = $1 
       GROUP BY status`,
      [buyerId]
    );

    res.json({
      success: true,
      data: {
        total_orders: parseInt(totalOrdersResult.rows[0].total_orders),
        total_spent: parseFloat(totalSpentResult.rows[0].total_spent),
        orders_by_status: ordersByStatusResult.rows
      }
    });
  } catch (error) {
    console.error('Get buyer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
});

module.exports = router;
