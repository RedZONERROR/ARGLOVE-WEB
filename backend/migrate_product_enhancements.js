require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'argloveweb',
  });

  try {
    console.log('Running product enhancements migration…');

    const [longDescCol] = await connection.query(
      "SHOW COLUMNS FROM products LIKE 'long_description'"
    );
    if (longDescCol.length === 0) {
      await connection.query(
        'ALTER TABLE products ADD COLUMN long_description TEXT NULL AFTER description'
      );
      console.log('Added products.long_description');
    }

    const [benefitsCol] = await connection.query(
      "SHOW COLUMNS FROM products LIKE 'key_benefits'"
    );
    if (benefitsCol.length === 0) {
      await connection.query(
        'ALTER TABLE products ADD COLUMN key_benefits JSON NULL AFTER long_description'
      );
      console.log('Added products.key_benefits');
    }

    const [sortCol] = await connection.query(
      "SHOW COLUMNS FROM resources LIKE 'sort_order'"
    );
    if (sortCol.length === 0) {
      await connection.query(
        'ALTER TABLE resources ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER file_role'
      );
      console.log('Added resources.sort_order');
    }

    await connection.query(`
      ALTER TABLE resources
      MODIFY file_role ENUM('thumbnail', 'gallery', 'avatar', 'banner', 'attachment', 'video')
      DEFAULT 'gallery'
    `);
    console.log('Extended resources.file_role with video');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        user_id INT DEFAULT NULL,
        reviewer_name VARCHAR(255) NOT NULL,
        reviewer_email VARCHAR(255) NOT NULL,
        rating TINYINT NOT NULL,
        title VARCHAR(255) DEFAULT NULL,
        body TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX (product_id),
        INDEX (status)
      ) ENGINE=InnoDB
    `);
    console.log('Ensured product_reviews table');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_review_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        review_id INT NOT NULL,
        file_url VARCHAR(512) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('Ensured product_review_photos table');

    console.log('Product enhancements migration complete.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
