const db = require('../config/db');

/**
 * Atomically mark a pending order as paid: lock row, deduct stock, record payment, clear cart.
 * @returns {{ fulfilled: boolean, reason?: string }}
 */
async function fulfillPaidOrder(orderId, paymentRecord) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (orders.length === 0) {
      await connection.rollback();
      return { fulfilled: false, reason: 'not_found' };
    }

    const order = orders[0];
    if (order.status !== 'pending') {
      await connection.rollback();
      return { fulfilled: false, reason: 'already_processed' };
    }

    const [items] = await connection.query(
      'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?',
      [order.id]
    );

    for (const item of items) {
      if (item.variant_id) {
        const [stockRows] = await connection.query(
          'SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE',
          [item.variant_id]
        );
        if (stockRows.length === 0 || stockRows[0].stock_quantity < item.quantity) {
          await connection.rollback();
          return { fulfilled: false, reason: 'insufficient_stock' };
        }
        await connection.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.variant_id]
        );
      } else {
        const [stockRows] = await connection.query(
          'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
          [item.product_id]
        );
        if (stockRows.length === 0 || stockRows[0].stock_quantity < item.quantity) {
          await connection.rollback();
          return { fulfilled: false, reason: 'insufficient_stock' };
        }
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    await connection.query("UPDATE orders SET status = 'processing' WHERE id = ?", [order.id]);

    await connection.query(
      `INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_method, status, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        paymentRecord.razorpay_order_id,
        paymentRecord.razorpay_payment_id,
        paymentRecord.razorpay_signature,
        paymentRecord.payment_method || 'UPI',
        paymentRecord.status || 'captured',
        order.total_amount,
      ]
    );

    const [carts] = await connection.query('SELECT id FROM carts WHERE user_id = ?', [order.user_id]);
    if (carts.length > 0) {
      await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
    }

    await connection.commit();
    return { fulfilled: true, order };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { fulfillPaidOrder };
