const db = require('../config/db');
const { parseKeyBenefits } = require('./productReviewController');
const { fetchProductVariants } = require('../utils/productVariants');

async function fetchProductMedia(productId) {
  const [resources] = await db.query(
    `SELECT id, file_url, file_name, mime_type, file_role, sort_order
     FROM resources WHERE owner_type = 'Product' AND owner_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [productId]
  );
  return resources;
}

exports.getProductById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ? AND p.is_published = TRUE`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    const product = products[0];
    product.key_benefits = parseKeyBenefits(product.key_benefits);

    const resources = await fetchProductMedia(id);
    const variants = await fetchProductVariants(id);

    const [reviewStats] = await db.query(
      `SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average
       FROM product_reviews WHERE product_id = ? AND status = 'approved'`,
      [id]
    );

    res.status(200).json({
      product,
      resources,
      variants,
      review_stats: {
        count: reviewStats[0].count,
        average: parseFloat(Number(reviewStats[0].average).toFixed(1)),
      },
    });
  } catch (error) {
    next(error);
  }
};

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

exports.getCategories = async (req, res, next) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories');
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

exports.fetchProductMedia = fetchProductMedia;
