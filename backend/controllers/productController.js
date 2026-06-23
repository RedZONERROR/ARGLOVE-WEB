const db = require('../config/db');

exports.getProducts = async (req, res, next) => {
  const { category, search } = req.query;

  try {
    let query = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.is_published = TRUE
    `;
    const params = [];

    if (category) {
      query += ' AND (c.slug = ? OR c.id = ?)';
      params.push(category, category);
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [products] = await db.query(query, params);
    res.status(200).json({ products });
  } catch (error) {
    next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ?`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    const product = products[0];

    // Fetch related images/media from polymorphic resources
    const [resources] = await db.query(
      'SELECT id, file_url, file_name, mime_type, file_role FROM resources WHERE owner_type = "Product" AND owner_id = ?',
      [id]
    );

    res.status(200).json({
      product,
      resources
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories');
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};
