/**
 * One-time migration: add refunded order status + razorpay_refund_id on payments.
 * Run: node migrate_order_refunds.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const db = require('./config/db');

async function run() {
  try {
    await db.query(`
      ALTER TABLE \`orders\`
      MODIFY COLUMN \`status\` ENUM('pending','processing','completed','cancelled','refunded') DEFAULT 'pending'
    `);
    console.log('✓ orders.status enum updated (added refunded)');

    try {
      await db.query(`
        ALTER TABLE \`payments\`
        ADD COLUMN \`razorpay_refund_id\` VARCHAR(255) NULL AFTER \`razorpay_payment_id\`
      `);
      console.log('✓ payments.razorpay_refund_id column added');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('→ payments.razorpay_refund_id already exists');
      } else {
        throw e;
      }
    }
  } finally {
    await db.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
