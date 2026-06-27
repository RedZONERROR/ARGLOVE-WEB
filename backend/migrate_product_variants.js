require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mysql = require('mysql2/promise');

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows.length > 0;
}

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'argloveweb',
  });

  try {
    console.log('Running product variants migration…');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        label VARCHAR(100) NOT NULL,
        regular_price DECIMAL(10, 2) NOT NULL,
        discount_price DECIMAL(10, 2) DEFAULT NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        badge VARCHAR(50) DEFAULT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_variants_product (product_id)
      ) ENGINE=InnoDB
    `);
    console.log('Ensured product_variants table');

    if (!(await columnExists(connection, 'cart_items', 'variant_id'))) {
      await connection.query(
        'ALTER TABLE cart_items ADD COLUMN variant_id INT DEFAULT NULL AFTER product_id'
      );
      await connection.query(
        'ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL'
      );
      console.log('Added cart_items.variant_id');
    }

    if (!(await columnExists(connection, 'order_items', 'variant_id'))) {
      await connection.query(
        'ALTER TABLE order_items ADD COLUMN variant_id INT DEFAULT NULL AFTER product_id'
      );
      await connection.query(
        'ALTER TABLE order_items ADD COLUMN variant_label VARCHAR(100) DEFAULT NULL AFTER variant_id'
      );
      console.log('Added order_items.variant_id and variant_label');
    }

    console.log('Product variants migration complete.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
