const db = require('../config/db');
const { plainTextFromHtml, mapPlainItemNames } = require('../utils/plainText');
const { getVariantById } = require('../utils/productVariants');

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
      `SELECT ci.id AS cart_item_id, ci.quantity, ci.variant_id,
              p.id AS product_id, p.name,
              p.regular_price AS product_regular_price,
              p.discount_price AS product_discount_price,
              pv.label AS variant_label,
              pv.regular_price AS variant_regular_price,
              pv.discount_price AS variant_discount_price
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    const mapped = items.map((item) => {
      const regular_price = item.variant_id ? item.variant_regular_price : item.product_regular_price;
      const discount_price = item.variant_id ? item.variant_discount_price : item.product_discount_price;
      const name = plainTextFromHtml(
        item.variant_label ? `${item.name} (${item.variant_label})` : item.name
      );
      return {
        cart_item_id: item.cart_item_id,
        quantity: item.quantity,
        product_id: item.product_id,
        variant_id: item.variant_id,
        variant_label: item.variant_label,
        name,
        regular_price,
        discount_price,
      };
    });

    res.status(200).json({ cart_id: cartId, items: mapped });
  } catch (error) {
    next(error);
  }
};

exports.addToCart = async (req, res, next) => {
  const { product_id, quantity = 1, variant_id = null } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: { message: 'Product ID is required.' } });
  }

  try {
    const [products] = await db.query('SELECT id FROM products WHERE id = ? AND is_published = TRUE', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    const resolvedVariantId = variant_id || null;
    if (resolvedVariantId) {
      const variant = await getVariantById(resolvedVariantId, product_id);
      if (!variant) {
        return res.status(400).json({ error: { message: 'Invalid product option selected.' } });
      }
    }

    const cartId = await getOrCreateCartId(req.user.id);
    const qty = parseInt(quantity, 10);

    const matchSql = resolvedVariantId
      ? 'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id = ?'
      : 'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id IS NULL';
    const matchParams = resolvedVariantId
      ? [cartId, product_id, resolvedVariantId]
      : [cartId, product_id];

    const [existingItems] = await db.query(matchSql, matchParams);

    if (existingItems.length > 0) {
      const newQuantity = existingItems[0].quantity + qty;
      await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQuantity, existingItems[0].id]);
    } else {
      await db.query(
        'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)',
        [cartId, product_id, resolvedVariantId, qty]
      );
    }

    res.status(200).json({ message: 'Product added to cart successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.updateCart = async (req, res, next) => {
  const { product_id, quantity, variant_id = null } = req.body;

  if (!product_id || quantity === undefined) {
    return res.status(400).json({ error: { message: 'Product ID and quantity are required.' } });
  }

  if (parseInt(quantity, 10) <= 0) {
    return res.status(400).json({ error: { message: 'Quantity must be greater than zero.' } });
  }

  try {
    const cartId = await getOrCreateCartId(req.user.id);
    const resolvedVariantId = variant_id || null;

    const matchSql = resolvedVariantId
      ? 'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ? AND variant_id = ?'
      : 'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ? AND variant_id IS NULL';
    const matchParams = resolvedVariantId
      ? [parseInt(quantity, 10), cartId, product_id, resolvedVariantId]
      : [parseInt(quantity, 10), cartId, product_id];

    const [result] = await db.query(matchSql, matchParams);

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
  const variant_id = req.query.variant_id ? parseInt(req.query.variant_id, 10) : null;

  try {
    const cartId = await getOrCreateCartId(req.user.id);

    const matchSql = variant_id
      ? 'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id = ?'
      : 'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id IS NULL';
    const matchParams = variant_id ? [cartId, product_id, variant_id] : [cartId, product_id];

    const [result] = await db.query(matchSql, matchParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { message: 'Product not found in cart.' } });
    }

    res.status(200).json({ message: 'Product removed from cart successfully.' });
  } catch (error) {
    next(error);
  }
};
