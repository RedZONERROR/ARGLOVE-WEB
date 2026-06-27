require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./app');
const db = require('./config/db');
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await db.ping();
    console.log(`Database connected (${process.env.DB_HOST}/${process.env.DB_NAME})`);
  } catch (err) {
    console.error('Database connection failed:', err.code || err.message);
    console.error('Check backend/.env and Hostinger remote MySQL access for your IP.');
  }
});
