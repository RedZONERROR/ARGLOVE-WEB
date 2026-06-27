const db = require('../config/db');
const { refundPayment } = require('../utils/razorpayClient');
const { fetchProductVariants, syncProductVariants } = require('../utils/productVariants');
const { mapPlainItemNames } = require('../utils/plainText');

const VALID_ORDER_STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'refunded'];

async function restockOrderItems(connection, orderId) {
  const [items] = await connection.query(
    'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
    [orderId]
  );
  for (const item of items) {
    await connection.query(
      'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
      [item.quantity, item.product_id]
    );
  }
}

async function processOrderRefund(connection, orderId, adminUserId, ip) {
  const [payments] = await connection.query(
    "SELECT * FROM payments WHERE order_id = ? AND status = 'captured' ORDER BY id DESC LIMIT 1",
    [orderId]
  );

  if (payments.length === 0) {
    const err = new Error('No captured payment found for this order.');
    err.statusCode = 400;
    throw err;
  }

  const payment = payments[0];
  if (!payment.razorpay_payment_id) {
    const err = new Error('Payment record missing Razorpay payment ID.');
    err.statusCode = 400;
    throw err;
  }

  const amountPaise = Math.round(parseFloat(payment.amount) * 100);
  const refundResult = await refundPayment(payment.razorpay_payment_id, amountPaise);

  await connection.query(
    "UPDATE payments SET status = 'refunded', razorpay_refund_id = ? WHERE id = ?",
    [refundResult.id, payment.id]
  );

  await restockOrderItems(connection, orderId);
  await connection.query("UPDATE orders SET status = 'refunded' WHERE id = ?", [orderId]);

  await connection.query(
    'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
    [
      adminUserId,
      `Admin refunded order #${orderId} via Razorpay (refund: ${refundResult.id})`,
      ip || '127.0.0.1',
    ]
  );

  return {
    refund_id: refundResult.id,
    refund_status: refundResult.status,
    payment_id: payment.razorpay_payment_id,
  };
}

function attachLatestPayment(orderRow, paymentRow) {
  if (!paymentRow) {
    return {
      ...orderRow,
      razorpay_payment_id: null,
      razorpay_order_id: orderRow.razorpay_order_id || null,
      payment_status: null,
      razorpay_refund_id: null,
    };
  }
  return {
    ...orderRow,
    razorpay_payment_id: paymentRow.razorpay_payment_id,
    razorpay_order_id: paymentRow.razorpay_order_id || orderRow.razorpay_order_id,
    payment_status: paymentRow.status,
    razorpay_refund_id: paymentRow.razorpay_refund_id || null,
  };
}

exports.createProduct = async (req, res, next) => {
  const {
    name,
    description,
    long_description = null,
    key_benefits = null,
    regular_price,
    discount_price = null,
    stock_quantity = 0,
    category_id = null,
    is_published = true,
    variants = [],
  } = req.body;

  if (!name || !description || regular_price === undefined) {
    return res.status(400).json({ error: { message: 'Name, description, and regular price are required.' } });
  }

  try {
    const benefitsJson = key_benefits ? JSON.stringify(key_benefits) : null;
    const [result] = await db.query(
      `INSERT INTO products (category_id, name, description, long_description, key_benefits, regular_price, discount_price, stock_quantity, is_published) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id,
        name,
        description,
        long_description,
        benefitsJson,
        parseFloat(regular_price),
        discount_price ? parseFloat(discount_price) : null,
        parseInt(stock_quantity, 10),
        is_published ? 1 : 0,
      ]
    );

    const productId = result.insertId;
    if (Array.isArray(variants) && variants.length > 0) {
      await syncProductVariants(productId, variants);
    }

    res.status(201).json({
      message: 'Product created successfully.',
      product: {
        id: productId,
        category_id,
        name,
        description,
        regular_price: parseFloat(regular_price),
        discount_price: discount_price ? parseFloat(discount_price) : null,
        stock_quantity: parseInt(stock_quantity, 10),
        is_published: !!is_published
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  const { id } = req.params;
  const {
    name,
    description,
    long_description,
    key_benefits,
    regular_price,
    discount_price = null,
    stock_quantity = 0,
    category_id = null,
    is_published,
    variants,
  } = req.body;

  if (!name || !description || regular_price === undefined) {
    return res.status(400).json({ error: { message: 'Name, description, and regular price are required.' } });
  }

  try {
    const benefitsJson = key_benefits !== undefined ? JSON.stringify(key_benefits) : undefined;
    const publishClause = is_published !== undefined ? ', is_published = ?' : '';
    const longDescClause = long_description !== undefined ? ', long_description = ?' : '';
    const benefitsClause = benefitsJson !== undefined ? ', key_benefits = ?' : '';

    const params = [
      category_id,
      name,
      description,
      parseFloat(regular_price),
      discount_price ? parseFloat(discount_price) : null,
      parseInt(stock_quantity, 10),
    ];
    if (long_description !== undefined) params.push(long_description);
    if (benefitsJson !== undefined) params.push(benefitsJson);
    if (is_published !== undefined) params.push(is_published ? 1 : 0);
    params.push(id);

    const [result] = await db.query(
      `UPDATE products 
       SET category_id = ?, name = ?, description = ?, regular_price = ?, discount_price = ?, stock_quantity = ?${longDescClause}${benefitsClause}${publishClause}
       WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    if (variants !== undefined) {
      await syncProductVariants(id, variants);
    }

    res.status(200).json({
      message: 'Product updated successfully.',
      product: {
        id: parseInt(id, 10),
        category_id,
        name,
        description,
        regular_price: parseFloat(regular_price),
        discount_price: discount_price ? parseFloat(discount_price) : null,
        stock_quantity: parseInt(stock_quantity, 10),
        ...(is_published !== undefined ? { is_published: !!is_published } : {})
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Soft-archive by setting is_published to false (protects order item histories)
    const [result] = await db.query('UPDATE products SET is_published = FALSE WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    res.status(200).json({ message: 'Product archived successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  const { name, slug, parent_id = null } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: { message: 'Name and slug are required.' } });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO categories (name, slug, parent_id) VALUES (?, ?, ?)',
      [name, slug, parent_id]
    );

    res.status(201).json({
      message: 'Category created successfully.',
      category: {
        id: result.insertId,
        name,
        slug,
        parent_id
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  const { id } = req.params;
  let { status } = req.body;

  if (!VALID_ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: { message: 'Invalid order status.' } });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT status FROM orders WHERE id = ? FOR UPDATE',
      [id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    const currentStatus = orders[0].status;

    if (currentStatus === status) {
      await connection.commit();
      return res.status(200).json({ message: 'Order status updated successfully.', status });
    }

    const ip = req.ip || '127.0.0.1';

    // Cancelling a paid order → refund via Razorpay and mark refunded
    if (status === 'cancelled' && ['processing', 'completed'].includes(currentStatus)) {
      const refundInfo = await processOrderRefund(connection, id, req.user.id, ip);
      await connection.commit();
      return res.status(200).json({
        message: 'Order cancelled and refund processed via Razorpay.',
        status: 'refunded',
        refund: refundInfo,
      });
    }

    if (status === 'refunded') {
      if (currentStatus === 'refunded') {
        await connection.commit();
        return res.status(200).json({ message: 'Order already refunded.', status: 'refunded' });
      }
      const refundInfo = await processOrderRefund(connection, id, req.user.id, ip);
      await connection.commit();
      return res.status(200).json({
        message: 'Refund processed via Razorpay.',
        status: 'refunded',
        refund: refundInfo,
      });
    }

    if (status === 'cancelled' && currentStatus !== 'cancelled' && currentStatus !== 'pending') {
      await restockOrderItems(connection, id);
    }

    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    await connection.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user.id, `Admin updated order #${id} status to ${status}`, ip]
    );

    await connection.commit();
    res.status(200).json({ message: 'Order status updated successfully.', status });
  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: { message: error.message } });
    }
    next(error);
  } finally {
    connection.release();
  }
};

exports.refundOrder = async (req, res, next) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT status FROM orders WHERE id = ? FOR UPDATE',
      [id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    const currentStatus = orders[0].status;
    if (currentStatus === 'refunded') {
      await connection.commit();
      return res.status(200).json({ message: 'Order is already refunded.', status: 'refunded' });
    }

    if (!['processing', 'completed'].includes(currentStatus)) {
      await connection.rollback();
      return res.status(400).json({
        error: { message: 'Only paid orders (processing/completed) can be refunded.' },
      });
    }

    const refundInfo = await processOrderRefund(connection, id, req.user.id, req.ip || '127.0.0.1');
    await connection.commit();

    res.status(200).json({
      message: 'Refund processed successfully via Razorpay.',
      status: 'refunded',
      refund: refundInfo,
    });
  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: { message: error.message } });
    }
    next(error);
  } finally {
    connection.release();
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.email AS user_email 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       ORDER BY o.created_at DESC`
    );

    const fullOrders = [];
    for (const order of orders) {
      const [items] = await db.query(
        `SELECT oi.quantity, oi.price_at_purchase, p.name 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      const [payments] = await db.query(
        `SELECT razorpay_payment_id, razorpay_order_id, status, razorpay_refund_id, amount, payment_method
         FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
        [order.id]
      );
      fullOrders.push(attachLatestPayment({ ...order, items: mapPlainItemNames(items) }, payments[0]));
    }

    res.status(200).json({ orders: fullOrders });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.email AS user_email 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    const order = orders[0];

    const [items] = await db.query(
      `SELECT oi.quantity, oi.price_at_purchase, p.id AS product_id, p.name 
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    const [payments] = await db.query(
      'SELECT * FROM payments WHERE order_id = ?',
      [id]
    );

    res.status(200).json({
      order,
      items: mapPlainItemNames(items),
      payments
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  const { id } = req.params;
  const { name, slug, parent_id = null } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: { message: 'Name and slug are required.' } });
  }

  try {
    const [result] = await db.query(
      'UPDATE categories SET name = ?, slug = ?, parent_id = ? WHERE id = ?',
      [name, slug, parent_id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Category not found.' } });
    }

    res.status(200).json({
      message: 'Category updated successfully.',
      category: {
        id: parseInt(id, 10),
        name,
        slug,
        parent_id
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Category not found.' } });
    }

    res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const [users] = await db.query(
      'SELECT id, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

exports.toggleUserStatus = async (req, res, next) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (is_active === undefined) {
    return res.status(400).json({ error: { message: 'is_active status is required.' } });
  }

  try {
    const [result] = await db.query(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [is_active ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    res.status(200).json({ message: 'User status updated successfully.', is_active: !!is_active });
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['customer', 'admin', 'editor'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: { message: 'Valid role is required (customer, admin, editor).' } });
  }

  // Prevent admin from removing their own admin role
  if (parseInt(id, 10) === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: { message: 'You cannot remove your own admin role.' } });
  }

  try {
    const [result] = await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    res.status(200).json({ message: 'User role updated successfully.', role });
  } catch (error) {
    next(error);
  }
};

exports.getAdminProducts = async (req, res, next) => {
  try {
    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       ORDER BY p.created_at DESC`
    );

    for (const product of products) {
      const [resources] = await db.query(
        `SELECT file_url FROM resources 
         WHERE owner_type = 'Product' AND owner_id = ? AND file_role = 'thumbnail' 
         ORDER BY id DESC LIMIT 1`,
        [product.id]
      );
      product.thumbnail_url = resources[0]?.file_url || null;
    }

    res.status(200).json({ products });
  } catch (error) {
    next(error);
  }
};

exports.getAdminProductById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    const product = products[0];
    if (product.key_benefits) {
      try {
        product.key_benefits = JSON.parse(product.key_benefits);
      } catch {
        product.key_benefits = [];
      }
    } else {
      product.key_benefits = [];
    }

    const [resources] = await db.query(
      `SELECT id, file_url, file_name, mime_type, file_role, sort_order
       FROM resources WHERE owner_type = 'Product' AND owner_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [id]
    );

    const [reviews] = await db.query(
      `SELECT id, reviewer_name, reviewer_email, rating, title, body, status, created_at
       FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    const variants = await fetchProductVariants(id);

    res.status(200).json({ product, resources, reviews, variants });
  } catch (error) {
    next(error);
  }
};

exports.getPromoCodes = async (req, res, next) => {
  try {
    const [promos] = await db.query(
      `SELECT pc.*, 
        (SELECT COUNT(*) FROM orders o WHERE o.promo_code_id = pc.id) AS usage_count
       FROM promo_codes pc 
       ORDER BY pc.id DESC`
    );
    res.status(200).json({ promos });
  } catch (error) {
    next(error);
  }
};

exports.createPromoCode = async (req, res, next) => {
  const { code, discount_type = 'percentage', discount_value, expiry_date } = req.body;

  if (!code || discount_value === undefined || !expiry_date) {
    return res.status(400).json({ error: { message: 'Code, discount value, and expiry date are required.' } });
  }

  const validTypes = ['percentage', 'fixed'];
  if (!validTypes.includes(discount_type)) {
    return res.status(400).json({ error: { message: 'Invalid discount type.' } });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO promo_codes (code, discount_type, discount_value, expiry_date) VALUES (?, ?, ?, ?)',
      [code.toUpperCase().trim(), discount_type, parseFloat(discount_value), expiry_date]
    );

    res.status(201).json({
      message: 'Promo code created successfully.',
      promo: {
        id: result.insertId,
        code: code.toUpperCase().trim(),
        discount_type,
        discount_value: parseFloat(discount_value),
        expiry_date
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: { message: 'Promo code already exists.' } });
    }
    next(error);
  }
};

exports.updatePromoCode = async (req, res, next) => {
  const { id } = req.params;
  const { code, discount_type, discount_value, expiry_date } = req.body;

  if (!code || discount_value === undefined || !expiry_date || !discount_type) {
    return res.status(400).json({ error: { message: 'Code, discount type, value, and expiry date are required.' } });
  }

  try {
    const [result] = await db.query(
      'UPDATE promo_codes SET code = ?, discount_type = ?, discount_value = ?, expiry_date = ? WHERE id = ?',
      [code.toUpperCase().trim(), discount_type, parseFloat(discount_value), expiry_date, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Promo code not found.' } });
    }

    res.status(200).json({ message: 'Promo code updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: { message: 'Promo code already exists.' } });
    }
    next(error);
  }
};

exports.deletePromoCode = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM promo_codes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Promo code not found.' } });
    }

    res.status(200).json({ message: 'Promo code deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
