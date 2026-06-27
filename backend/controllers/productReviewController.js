const db = require('../config/db');
const { sendEmail } = require('../utils/mailer');
const { plainTextFromHtml } = require('../utils/plainText');

async function userHasDeliveredPurchase(userId, productId) {
  const [rows] = await db.query(
    `SELECT 1
     FROM orders o
     INNER JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'completed'
     LIMIT 1`,
    [userId, productId]
  );
  return rows.length > 0;
}

async function userHasPendingDelivery(userId, productId) {
  const [rows] = await db.query(
    `SELECT 1
     FROM orders o
     INNER JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('pending', 'processing')
     LIMIT 1`,
    [userId, productId]
  );
  return rows.length > 0;
}

async function userAlreadyReviewed(userId, productId) {
  const [rows] = await db.query(
    'SELECT id, status FROM product_reviews WHERE user_id = ? AND product_id = ? LIMIT 1',
    [userId, productId]
  );
  return rows[0] || null;
}

function parseKeyBenefits(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

exports.getProductReviews = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [reviews] = await db.query(
      `SELECT r.id, r.reviewer_name, r.rating, r.title, r.body, r.created_at, u.email AS user_email
       FROM product_reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ? AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [id]
    );

    const withPhotos = [];
    for (const review of reviews) {
      const [photos] = await db.query(
        'SELECT id, file_url FROM product_review_photos WHERE review_id = ?',
        [review.id]
      );
      withPhotos.push({ ...review, photos });
    }

    const [stats] = await db.query(
      `SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average
       FROM product_reviews WHERE product_id = ? AND status = 'approved'`,
      [id]
    );

    res.status(200).json({
      reviews: withPhotos,
      stats: {
        count: stats[0].count,
        average: parseFloat(Number(stats[0].average).toFixed(1)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getReviewEligibility = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [products] = await db.query(
      'SELECT id FROM products WHERE id = ? AND is_published = TRUE',
      [id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }

    if (!req.user?.id) {
      return res.status(200).json({ can_review: false, reason: 'login_required' });
    }

    const userId = req.user.id;

    const existing = await userAlreadyReviewed(userId, id);
    if (existing) {
      const reason = existing.status === 'pending' ? 'review_pending' : 'already_reviewed';
      return res.status(200).json({
        can_review: false,
        reason,
        review_status: existing.status,
      });
    }

    if (await userHasDeliveredPurchase(userId, id)) {
      return res.status(200).json({ can_review: true, reason: 'eligible' });
    }

    if (await userHasPendingDelivery(userId, id)) {
      return res.status(200).json({ can_review: false, reason: 'awaiting_delivery' });
    }

    return res.status(200).json({ can_review: false, reason: 'purchase_required' });
  } catch (error) {
    next(error);
  }
};

exports.submitProductReview = async (req, res, next) => {
  const { id } = req.params;
  const { reviewer_name, rating, title, body } = req.body;

  if (!req.user?.id) {
    return res.status(401).json({ error: { message: 'You must be logged in to submit a review.' } });
  }

  if (!reviewer_name || !rating || !body) {
    return res.status(400).json({
      error: { message: 'Name, rating, and review text are required.' },
    });
  }

  const ratingNum = parseInt(rating, 10);
  if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: { message: 'Rating must be between 1 and 5.' } });
  }

  try {
    const [products] = await db.query(
      'SELECT id, name FROM products WHERE id = ? AND is_published = TRUE',
      [id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: { message: 'Product not found.' } });
    }
    const product = products[0];
    const productLabel = plainTextFromHtml(product.name) || 'Product';

    const userId = req.user.id;

    const existing = await userAlreadyReviewed(userId, id);
    if (existing) {
      return res.status(409).json({ error: { message: 'You have already reviewed this product.' } });
    }

    if (!(await userHasDeliveredPurchase(userId, id))) {
      return res.status(403).json({
        error: {
          message: 'You can only review products you have purchased and received (delivered).',
        },
      });
    }

    const [users] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
    const reviewerEmail = users[0]?.email;
    if (!reviewerEmail) {
      return res.status(400).json({ error: { message: 'Account email not found.' } });
    }

    const [result] = await db.query(
      `INSERT INTO product_reviews (product_id, user_id, reviewer_name, reviewer_email, rating, title, body, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, userId, reviewer_name.trim(), reviewerEmail.toLowerCase(), ratingNum, title || null, body.trim()]
    );
    const reviewId = result.insertId;

    const files = req.files || [];
    const photoUrls = [];
    for (const file of files) {
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      await db.query(
        'INSERT INTO product_review_photos (review_id, file_url, file_name) VALUES (?, ?, ?)',
        [reviewId, fileUrl, file.filename]
      );
      photoUrls.push(fileUrl);
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'admin@arglove.com';
    await sendEmail({
      to: adminEmail,
      subject: `New product review pending — ${productLabel}`,
      text: `A new review was submitted for "${productLabel}" by ${reviewer_name} (${reviewerEmail}).\nRating: ${ratingNum}/5\n\n${body}\n\nApprove it in the admin panel.`,
    });

    await sendEmail({
      to: reviewerEmail,
      subject: 'Thank you for your ARGLOVE review',
      text: `Hi ${reviewer_name},\n\nThank you for reviewing ${productLabel}. Your review has been received and will appear on our site after moderation.\n\n— ARGLOVE Team`,
    });

    res.status(201).json({
      message: 'Review submitted successfully. You will receive a confirmation email.',
      review_id: reviewId,
      photos: photoUrls,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAdminProductReviews = async (req, res, next) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT r.*, p.name AS product_name
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
    `;
    const params = [];
    if (status) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }
    query += ' ORDER BY r.created_at DESC LIMIT 200';

    const [reviews] = await db.query(query, params);
    res.status(200).json({ reviews });
  } catch (error) {
    next(error);
  }
};

exports.moderateReview = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: { message: 'Invalid status.' } });
  }
  try {
    await db.query('UPDATE product_reviews SET status = ? WHERE id = ?', [status, id]);
    res.status(200).json({ message: 'Review updated.' });
  } catch (error) {
    next(error);
  }
};

exports.parseKeyBenefits = parseKeyBenefits;
