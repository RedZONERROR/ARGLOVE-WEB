const db = require('../config/db');

exports.getWishlist = async (req, res, next) => {
  try {
    const [items] = await db.query(
      `SELECT wi.created_at, p.id AS product_id, p.name, p.regular_price, p.discount_price, p.description 
       FROM wishlist_items wi 
       JOIN products p ON wi.product_id = p.id 
       WHERE wi.user_id = ? 
       ORDER BY wi.created_at DESC`,
      [req.user.id]
    );

    res.status(200).json({ wishlist: items });
  } catch (error) {
    next(error);
  }
};

exports.addToWishlist = async (req, res, next) => {
  const { product_id } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: { message: 'Product ID is required.' } });
  }

  try {
    // 1. Verify product exists
    const [products] = await db.query('SELECT id FROM products WHERE id = ? AND is_published = TRUE', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    // 2. Check if already in wishlist
    const [existing] = await db.query(
      'SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (existing.length > 0) {
      return res.status(200).json({ message: 'Product is already in your wishlist.' });
    }

    // 3. Insert new wishlist item
    await db.query(
      'INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)',
      [req.user.id, product_id]
    );

    res.status(201).json({ message: 'Product added to wishlist successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.removeFromWishlist = async (req, res, next) => {
  const { product_id } = req.params;

  try {
    const [result] = await db.query(
      'DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Product not found in your wishlist.' } });
    }

    res.status(200).json({ message: 'Product removed from wishlist successfully.' });
  } catch (error) {
    next(error);
  }
};
