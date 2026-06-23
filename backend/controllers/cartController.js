const db = require('../config/db');

// Helper to get or create a cart for the logged-in user
async function getOrCreateCartId(userId) {
  const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [userId]);
  if (carts.length > 0) {
    return carts[0].id;
  }
  const [result] = await db.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
  return result.insertId;
}

exports.getCart = async (req, res, next) => {
  try {
    const cartId = await getOrCreateCartId(req.user.id);

    const [items] = await db.query(
      `SELECT ci.id AS cart_item_id, ci.quantity, p.id AS product_id, p.name, p.regular_price, p.discount_price 
       FROM cart_items ci 
       JOIN products p ON ci.product_id = p.id 
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    res.status(200).json({ cart_id: cartId, items });
  } catch (error) {
    next(error);
  }
};

exports.addToCart = async (req, res, next) => {
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: { message: 'Product ID is required.' } });
  }

  try {
    // Verify product exists and is published
    const [products] = await db.query('SELECT id FROM products WHERE id = ? AND is_published = TRUE', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    const cartId = await getOrCreateCartId(req.user.id);

    // Check if product is already in the cart
    const [existingItems] = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, product_id]
    );

    if (existingItems.length > 0) {
      const newQuantity = existingItems[0].quantity + parseInt(quantity, 10);
      await db.query(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [newQuantity, existingItems[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
        [cartId, product_id, parseInt(quantity, 10)]
      );
    }

    res.status(200).json({ message: 'Product added to cart successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.updateCart = async (req, res, next) => {
  const { product_id, quantity } = req.body;

  if (!product_id || quantity === undefined) {
    return res.status(400).json({ error: { message: 'Product ID and quantity are required.' } });
  }

  if (parseInt(quantity, 10) <= 0) {
    return res.status(400).json({ error: { message: 'Quantity must be greater than zero.' } });
  }

  try {
    const cartId = await getOrCreateCartId(req.user.id);

    const [result] = await db.query(
      'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
      [parseInt(quantity, 10), cartId, product_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Product not found in cart.' } });
    }

    res.status(200).json({ message: 'Cart updated successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.removeFromCart = async (req, res, next) => {
  const { product_id } = req.params;

  try {
    const cartId = await getOrCreateCartId(req.user.id);

    const [result] = await db.query(
      'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, product_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Product not found in cart.' } });
    }

    res.status(200).json({ message: 'Product removed from cart successfully.' });
  } catch (error) {
    next(error);
  }
};
