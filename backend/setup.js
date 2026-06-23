require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// Hash password helper using SHA256 (lightweight, native, zero compilation errors on Windows)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function setup() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };

  const dbName = process.env.DB_NAME || 'argloveweb';

  console.log(`Connecting to MySQL server at ${dbConfig.host}:${dbConfig.port}...`);
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Successfully connected to MySQL server.');

    // 1. Create Database if it does not exist
    console.log(`Creating database "${dbName}" if it does not exist...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);
    console.log(`Using database "${dbName}".`);

    // 2. Disable foreign key checks temporarily to cleanly rebuild tables if needed
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Drop tables if they exist to start fresh (Optional, but highly helpful for setup scripts)
    const tablesToDrop = [
      'wishlist_items', 'activity_logs', 'blog_comments', 'blogs', 'payments', 'order_items', 
      'orders', 'promo_codes', 'cart_items', 'carts', 'resources', 
      'products', 'categories', 'user_addresses', 'users'
    ];
    for (const table of tablesToDrop) {
      await connection.query(`DROP TABLE IF EXISTS \`${table}\`;`);
    }
    console.log('Cleared any existing tables.');

    // 3. Create Tables in dependency order

    // Users
    console.log('Creating "users" table...');
    await connection.query(`
      CREATE TABLE \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('customer', 'admin', 'editor') DEFAULT 'customer',
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (\`email\`)
      ) ENGINE=InnoDB;
    `);

    // User Addresses
    console.log('Creating "user_addresses" table...');
    await connection.query(`
      CREATE TABLE \`user_addresses\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`address_type\` ENUM('shipping', 'billing') DEFAULT 'shipping',
        \`recipient_name\` VARCHAR(255) NOT NULL,
        \`street_address\` VARCHAR(255) NOT NULL,
        \`city\` VARCHAR(100) NOT NULL,
        \`state\` VARCHAR(100) NOT NULL,
        \`postal_code\` VARCHAR(20) NOT NULL,
        \`phone_number\` VARCHAR(20) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Categories
    console.log('Creating "categories" table...');
    await connection.query(`
      CREATE TABLE \`categories\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL,
        \`slug\` VARCHAR(100) NOT NULL UNIQUE,
        \`parent_id\` INT DEFAULT NULL,
        FOREIGN KEY (\`parent_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE SET NULL,
        INDEX (\`slug\`)
      ) ENGINE=InnoDB;
    `);

    // Products
    console.log('Creating "products" table...');
    await connection.query(`
      CREATE TABLE \`products\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`category_id\` INT DEFAULT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`regular_price\` DECIMAL(10, 2) NOT NULL,
        \`discount_price\` DECIMAL(10, 2) DEFAULT NULL,
        \`stock_quantity\` INT DEFAULT 0,
        \`is_published\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE SET NULL,
        INDEX (\`name\`)
      ) ENGINE=InnoDB;
    `);

    // Resources (Polymorphic Media)
    console.log('Creating "resources" table...');
    await connection.query(`
      CREATE TABLE \`resources\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`file_url\` VARCHAR(512) NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`mime_type\` VARCHAR(100) NOT NULL,
        \`owner_type\` VARCHAR(50) NOT NULL,
        \`owner_id\` INT NOT NULL,
        \`file_role\` ENUM('thumbnail', 'gallery', 'avatar', 'banner', 'attachment') DEFAULT 'gallery',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (\`owner_type\`, \`owner_id\`)
      ) ENGINE=InnoDB;
    `);

    // Carts
    console.log('Creating "carts" table...');
    await connection.query(`
      CREATE TABLE \`carts\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Cart Items
    console.log('Creating "cart_items" table...');
    await connection.query(`
      CREATE TABLE \`cart_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`cart_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`quantity\` INT DEFAULT 1,
        FOREIGN KEY (\`cart_id\`) REFERENCES \`carts\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Promo Codes
    console.log('Creating "promo_codes" table...');
    await connection.query(`
      CREATE TABLE \`promo_codes\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`code\` VARCHAR(50) NOT NULL UNIQUE,
        \`discount_type\` ENUM('percentage', 'fixed') DEFAULT 'percentage',
        \`discount_value\` DECIMAL(10, 2) NOT NULL,
        \`expiry_date\` TIMESTAMP NOT NULL,
        INDEX (\`code\`)
      ) ENGINE=InnoDB;
    `);

    // Orders
    console.log('Creating "orders" table...');
    await connection.query(`
      CREATE TABLE \`orders\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`promo_code_id\` INT DEFAULT NULL,
        \`total_amount\` DECIMAL(10, 2) NOT NULL,
        \`shipping_address\` TEXT NOT NULL,
        \`razorpay_order_id\` VARCHAR(255) UNIQUE DEFAULT NULL,
        \`status\` ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
        FOREIGN KEY (\`promo_code_id\`) REFERENCES \`promo_codes\`(\`id\`) ON DELETE SET NULL,
        INDEX (\`razorpay_order_id\`)
      ) ENGINE=InnoDB;
    `);

    // Order Items
    console.log('Creating "order_items" table...');
    await connection.query(`
      CREATE TABLE \`order_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`order_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`quantity\` INT NOT NULL,
        \`price_at_purchase\` DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB;
    `);

    // Payments
    console.log('Creating "payments" table...');
    await connection.query(`
      CREATE TABLE \`payments\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`order_id\` INT NOT NULL,
        \`razorpay_order_id\` VARCHAR(255) NOT NULL,
        \`razorpay_payment_id\` VARCHAR(255) UNIQUE DEFAULT NULL,
        \`razorpay_signature\` VARCHAR(255) DEFAULT NULL,
        \`payment_method\` VARCHAR(50) DEFAULT NULL,
        \`status\` ENUM('created', 'authorized', 'captured', 'failed', 'refunded') DEFAULT 'created',
        \`amount\` DECIMAL(10, 2) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE RESTRICT,
        INDEX (\`razorpay_order_id\`),
        INDEX (\`razorpay_payment_id\`)
      ) ENGINE=InnoDB;
    `);

    // Blogs
    console.log('Creating "blogs" table...');
    await connection.query(`
      CREATE TABLE \`blogs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`author_id\` INT NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`content\` TEXT NOT NULL,
        \`status\` ENUM('draft', 'published') DEFAULT 'draft',
        \`published_at\` TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB;
    `);

    // Blog Comments
    console.log('Creating "blog_comments" table...');
    await connection.query(`
      CREATE TABLE \`blog_comments\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`blog_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`comment_body\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`blog_id\`) REFERENCES \`blogs\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Activity Logs
    console.log('Creating "activity_logs" table...');
    await connection.query(`
      CREATE TABLE \`activity_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT DEFAULT NULL,
        \`action\` VARCHAR(255) NOT NULL,
        \`ip_address\` VARCHAR(45) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // Wishlist Items
    console.log('Creating "wishlist_items" table...');
    await connection.query(`
      CREATE TABLE \`wishlist_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE,
        UNIQUE KEY \`user_product\` (\`user_id\`, \`product_id\`)
      ) ENGINE=InnoDB;
    `);

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('All tables created successfully.');

    // 4. Seeding Data
    console.log('Seeding initial data...');

    // Seed Admin Account
    const adminEmail = 'admin@arglove.com';
    const adminPassword = 'adminpassword123';
    const adminHash = hashPassword(adminPassword);
    const [adminResult] = await connection.query(
      'INSERT INTO \`users\` (\`email\`, \`password_hash\`, \`role\`) VALUES (?, ?, ?);',
      [adminEmail, adminHash, 'admin']
    );
    const adminId = adminResult.insertId;
    console.log(`-> Created Admin Account: "${adminEmail}" (Password: "${adminPassword}")`);

    // Seed Customer Account
    const customerEmail = 'customer@example.com';
    const customerPassword = 'customer123';
    const customerHash = hashPassword(customerPassword);
    const [customerResult] = await connection.query(
      'INSERT INTO \`users\` (\`email\`, \`password_hash\`, \`role\`) VALUES (?, ?, ?);',
      [customerEmail, customerHash, 'customer']
    );
    const customerId = customerResult.insertId;
    console.log(`-> Created Customer Account: "${customerEmail}" (Password: "${customerPassword}")`);

    // Seed Address
    await connection.query(`
      INSERT INTO \`user_addresses\` (\`user_id\`, \`address_type\`, \`recipient_name\`, \`street_address\`, \`city\`, \`state\`, \`postal_code\`, \`phone_number\`) 
      VALUES (?, 'shipping', 'Jane Doe', '123 Maple Street', 'Mumbai', 'Maharashtra', '400001', '+919876543210');
    `, [customerId]);
    console.log('-> Seeded default customer shipping address.');

    // Seed Categories
    const [catFootwear] = await connection.query("INSERT INTO \`categories\` (\`name\`, \`slug\`) VALUES ('Footwear', 'footwear');");
    const [catApparel] = await connection.query("INSERT INTO \`categories\` (\`name\`, \`slug\`) VALUES ('Apparel', 'apparel');");
    console.log('-> Seeded categories (Footwear, Apparel).');

    // Seed Products
    const [prod1] = await connection.query(`
      INSERT INTO \`products\` (\`category_id\`, \`name\`, \`description\`, \`regular_price\`, \`discount_price\`, \`stock_quantity\`) 
      VALUES (?, 'Ultralight Running Shoes', 'Ultra lightweight mesh sports running shoes for athletics.', 5999.00, 4999.00, 100);
    `, [catFootwear.insertId]);

    const [prod2] = await connection.query(`
      INSERT INTO \`products\` (\`category_id\`, \`name\`, \`description\`, \`regular_price\`, \`discount_price\`, \`stock_quantity\`) 
      VALUES (?, 'Classic Cotton Hoodie', 'Warm and comfortable 100% premium cotton hoodie.', 2999.00, null, 50);
    `, [catApparel.insertId]);
    console.log('-> Seeded products (Shoes, Hoodie).');

    // Seed Resources (Images)
    await connection.query(`
      INSERT INTO \`resources\` (\`file_url\`, \`file_name\`, \`mime_type\`, \`owner_type\`, \`owner_id\`, \`file_role\`) 
      VALUES 
      ('https://images.unsplash.com/photo-1542291026-7eec264c27ff', 'shoe-red.jpg', 'image/jpeg', 'Product', ?, 'thumbnail'),
      ('https://images.unsplash.com/photo-1556911220-e15b29be8c8f', 'hoodie-cotton.jpg', 'image/jpeg', 'Product', ?, 'thumbnail');
    `, [prod1.insertId, prod2.insertId]);
    console.log('-> Seeded product media resources.');

    // Seed Promo Code
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    await connection.query(
      "INSERT INTO \`promo_codes\` (\`code\`, \`discount_type\`, \`discount_value\`, \`expiry_date\`) VALUES ('WELCOME10', 'percentage', 10.00, ?);",
      [nextYear]
    );
    console.log('-> Seeded promocode (WELCOME10 - 10% off).');

    // Seed Blog
    await connection.query(
      "INSERT INTO \`blogs\` (\`author_id\`, \`title\`, \`content\`, \`status\`, \`published_at\`) VALUES (?, 'Top running tips for beginners', 'Consistent pacing and proper footwear are key components of training...', 'published', CURRENT_TIMESTAMP);",
      [adminId]
    );
    console.log('-> Seeded initial blog post.');

    console.log('\nDatabase setup and seeding completed successfully!');

  } catch (error) {
    console.error('Error during database setup:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Disconnected from MySQL server.');
    }
  }
}

setup();
