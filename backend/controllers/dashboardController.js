const db = require('../config/db');

exports.getDashboardStats = async (req, res, next) => {
  try {
    // 1. Calculate Total Revenue from successfully captured payments
    const [revenueRows] = await db.query(
      "SELECT SUM(amount) AS total_revenue FROM payments WHERE status = 'captured'"
    );
    const totalRevenue = parseFloat(revenueRows[0].total_revenue || 0);

    // 2. Count Active Customers
    const [customerRows] = await db.query(
      "SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer' AND is_active = TRUE"
    );
    const totalCustomers = customerRows[0].total_customers;

    // 3. Count Orders grouped by status
    const [orderStatusRows] = await db.query(
      "SELECT status, COUNT(*) AS count FROM orders GROUP BY status"
    );
    const orderStats = {};
    orderStatusRows.forEach(row => {
      orderStats[row.status] = row.count;
    });

    // 4. Retrieve Low Stock Alerts (Stock < 10)
    const [lowStockRows] = await db.query(
      "SELECT id, name, stock_quantity FROM products WHERE stock_quantity < 10 AND is_published = TRUE"
    );

    // 5. Retrieve 10 Most Recent Activity Logs
    const [recentLogs] = await db.query(
      `SELECT al.id, al.action, al.ip_address, al.created_at, u.email AS user_email 
       FROM activity_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       ORDER BY al.created_at DESC 
       LIMIT 10`
    );

    res.status(200).json({
      metrics: {
        total_revenue: totalRevenue,
        total_customers: totalCustomers,
        order_stats: orderStats,
        low_stock_alerts: lowStockRows,
        recent_logs: recentLogs
      }
    });

  } catch (error) {
    next(error);
  }
};
