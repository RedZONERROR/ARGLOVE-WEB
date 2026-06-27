const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'argloveweb',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 5,
  idleTimeout: 60000,
});

const nativeQuery = pool.query.bind(pool);

pool.pool.on('connection', (connection) => {
  connection.on('error', (err) => {
    console.error('MySQL socket error:', err.code || err.message);
  });
});

pool.pool.on('error', (err) => {
  console.error('MySQL pool error:', err.code || err.message);
});

pool.query = async function queryWithRetry(sql, params) {
  try {
    return await nativeQuery(sql, params);
  } catch (error) {
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.warn('MySQL connection dropped, retrying once…');
      return nativeQuery(sql, params);
    }
    throw error;
  }
};

pool.ping = async function ping() {
  const [rows] = await nativeQuery('SELECT 1 AS ok');
  return rows;
};

module.exports = pool;
