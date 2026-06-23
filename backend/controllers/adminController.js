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
