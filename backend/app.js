require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { validateSecurityConfig, getCorsOrigins } = require('./config/security');

validateSecurityConfig();

const app = express();

const corsOrigins = getCorsOrigins();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const promoRoutes = require('./routes/promo');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const blogRoutes = require('./routes/blogs');
const resourceRoutes = require('./routes/resources');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const addressRoutes = require('./routes/addresses');
const wishlistRoutes = require('./routes/wishlist');
const cmsRoutes = require('./routes/cms');

app.use('/api/auth', authRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/products', productRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/payments', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/wishlist', wishlistRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: { message: 'Origin not allowed.' } });
  }

  const status = err.status || 500;
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  res.status(status).json({ error: { message } });
});

module.exports = app;
