const db = require('../config/db');

async function fetchProductVariants(productId) {
  try {
    const [rows] = await db.query(
      `SELECT id, product_id, label, regular_price, discount_price, stock_quantity, badge, is_default, sort_order
       FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, id ASC`,
      [productId]
    );
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw error;
  }
}

async function syncProductVariants(productId, variants = []) {
  if (!Array.isArray(variants)) return;

  await db.query('DELETE FROM product_variants WHERE product_id = ?', [productId]);

  let defaultSet = false;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const label = String(v.label || '').trim();
    if (!label) continue;

    const isDefault = v.is_default && !defaultSet;
    if (isDefault) defaultSet = true;

    await db.query(
      `INSERT INTO product_variants
       (product_id, label, regular_price, discount_price, stock_quantity, badge, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        label,
        parseFloat(v.regular_price),
        v.discount_price != null && v.discount_price !== '' ? parseFloat(v.discount_price) : null,
        parseInt(v.stock_quantity, 10) || 0,
        v.badge ? String(v.badge).trim() : null,
        isDefault ? 1 : 0,
        i,
      ]
    );
  }

  if (!defaultSet && variants.length > 0) {
    const [first] = await db.query(
      'SELECT id FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1',
      [productId]
    );
    if (first[0]) {
      await db.query('UPDATE product_variants SET is_default = 1 WHERE id = ?', [first[0].id]);
    }
  }
}

async function getVariantById(variantId, productId = null) {
  const params = [variantId];
  let query =
    'SELECT id, product_id, label, regular_price, discount_price, stock_quantity, badge, is_default FROM product_variants WHERE id = ?';
  if (productId) {
    query += ' AND product_id = ?';
    params.push(productId);
  }
  const [rows] = await db.query(query, params);
  return rows[0] || null;
}

function variantPrice(variant) {
  return variant.discount_price != null
    ? parseFloat(variant.discount_price)
    : parseFloat(variant.regular_price);
}

module.exports = {
  fetchProductVariants,
  syncProductVariants,
  getVariantById,
  variantPrice,
};
