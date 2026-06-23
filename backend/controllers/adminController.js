const db = require('../config/db');

exports.createProduct = async (req, res, next) => {
  const { name, description, regular_price, discount_price = null, stock_quantity = 0, category_id = null } = req.body;

  if (!name || !description || regular_price === undefined) {
    return res.status(400).json({ error: { message: 'Name, description, and regular price are required.' } });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO products (category_id, name, description, regular_price, discount_price, stock_quantity, is_published) 
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [category_id, name, description, parseFloat(regular_price), discount_price ? parseFloat(discount_price) : null, parseInt(stock_quantity, 10)]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      product: {
        id: result.insertId,
        category_id,
        name,
        description,
        regular_price: parseFloat(regular_price),
        discount_price: discount_price ? parseFloat(discount_price) : null,
        stock_quantity: parseInt(stock_quantity, 10),
        is_published: true
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  const { id } = req.params;
  const { name, description, regular_price, discount_price = null, stock_quantity = 0, category_id = null } = req.body;

  if (!name || !description || regular_price === undefined) {
    return res.status(400).json({ error: { message: 'Name, description, and regular price are required.' } });
  }

  try {
    const [result] = await db.query(
      `UPDATE products 
       SET category_id = ?, name = ?, description = ?, regular_price = ?, discount_price = ?, stock_quantity = ? 
       WHERE id = ?`,
      [category_id, name, description, parseFloat(regular_price), discount_price ? parseFloat(discount_price) : null, parseInt(stock_quantity, 10), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
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
        stock_quantity: parseInt(stock_quantity, 10)
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
  const { status } = req.body;

  const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: { message: 'Invalid order status.' } });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch current order status
    const [orders] = await connection.query(
      'SELECT status FROM orders WHERE id = ? FOR UPDATE',
      [id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    const currentStatus = orders[0].status;

    // 2. If status hasn't changed, just return success without doing double restock or updates
    if (currentStatus === status) {
      await connection.commit();
      return res.status(200).json({ message: 'Order status updated successfully.', status });
    }

    // 3. Handle inventory restoration if order is being cancelled (and was previously paid/processing/completed)
    if (status === 'cancelled' && currentStatus !== 'cancelled' && currentStatus !== 'pending') {
      const [items] = await connection.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );

      for (const item of items) {
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // 4. Update the order status
    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    // 5. Log activity
    await connection.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user.id, `Admin updated order #${id} status to ${status}`, req.ip || '127.0.0.1']
    );

    await connection.commit();
    res.status(200).json({ message: 'Order status updated successfully.', status });
  } catch (error) {
    await connection.rollback();
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
      fullOrders.push({
        ...order,
        items
      });
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
      items,
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
