const db = require('../config/db');

exports.getBlogs = async (req, res, next) => {
  try {
    const [blogs] = await db.query(
      `SELECT b.id, b.title, b.content, b.status, b.published_at, u.email AS author_email 
       FROM blogs b 
       JOIN users u ON b.author_id = u.id 
       WHERE b.status = 'published' 
       ORDER BY b.published_at DESC`
    );

    res.status(200).json({ blogs });
  } catch (error) {
    next(error);
  }
};

exports.getBlogById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [blogs] = await db.query(
      `SELECT b.id, b.title, b.content, b.status, b.published_at, u.email AS author_email 
       FROM blogs b 
       JOIN users u ON b.author_id = u.id 
       WHERE b.id = ?`,
      [id]
    );

    if (blogs.length === 0) {
      return res.status(404).json({ error: { message: 'Blog post not found.' } });
    }

    const blog = blogs[0];

    // Fetch polymorphic media resources (e.g. cover photo)
    const [resources] = await db.query(
      'SELECT id, file_url, file_name, mime_type, file_role FROM resources WHERE owner_type = "Blog" AND owner_id = ?',
      [id]
    );

    // Fetch associated comments
    const [comments] = await db.query(
      `SELECT bc.id, bc.comment_body, bc.created_at, u.email AS user_email 
       FROM blog_comments bc 
       JOIN users u ON bc.user_id = u.id 
       WHERE bc.blog_id = ? 
       ORDER BY bc.created_at ASC`,
      [id]
    );

    res.status(200).json({
      blog,
      resources,
      comments
    });
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  const { id } = req.params;
  const { comment_body } = req.body;

  if (!comment_body) {
    return res.status(400).json({ error: { message: 'Comment body is required.' } });
  }

  try {
    // Check if the blog post exists
    const [blogs] = await db.query('SELECT id FROM blogs WHERE id = ?', [id]);
    if (blogs.length === 0) {
      return res.status(404).json({ error: { message: 'Blog post not found.' } });
    }

    const [result] = await db.query(
      'INSERT INTO blog_comments (blog_id, user_id, comment_body) VALUES (?, ?, ?)',
      [id, req.user.id, comment_body]
    );

    res.status(201).json({
      message: 'Comment added successfully.',
      comment_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
};
