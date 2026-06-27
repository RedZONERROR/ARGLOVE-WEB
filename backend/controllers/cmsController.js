const db = require('../config/db');

function parseJsonIfNeeded(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

exports.getSection = async (req, res, next) => {
  const { key } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT section_key, content, updated_at FROM cms_content WHERE section_key = ?',
      [key]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: { message: 'CMS section not found.' } });
    }

    res.status(200).json({
      key: rows[0].section_key,
      content: parseJsonIfNeeded(rows[0].content),
      updated_at: rows[0].updated_at
    });
  } catch (error) {
    next(error);
  }
};

exports.getSections = async (req, res, next) => {
  const keysParam = (req.query.keys || '').toString().trim();
  const keys = keysParam
    ? keysParam.split(',').map((k) => k.trim()).filter(Boolean)
    : [];

  try {
    let rows;
    if (keys.length > 0) {
      const placeholders = keys.map(() => '?').join(', ');
      const [result] = await db.query(
        `SELECT section_key, content, updated_at FROM cms_content WHERE section_key IN (${placeholders})`,
        keys
      );
      rows = result;
    } else {
      const [result] = await db.query('SELECT section_key, content, updated_at FROM cms_content');
      rows = result;
    }

    const sections = {};
    for (const row of rows) {
      sections[row.section_key] = {
        content: parseJsonIfNeeded(row.content),
        updated_at: row.updated_at
      };
    }

    res.status(200).json({ sections });
  } catch (error) {
    next(error);
  }
};

// Admin write: PUT /api/admin/cms/:key
exports.updateContent = async (req, res, next) => {
  const { key } = req.params;
  const content = req.body && Object.prototype.hasOwnProperty.call(req.body, 'content') ? req.body.content : req.body;

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: { message: 'Invalid section key.' } });
  }

  if (content === null || content === undefined || typeof content !== 'object') {
    return res.status(400).json({ error: { message: 'CMS content must be a JSON object.' } });
  }

  try {
    const updatedBy = req.user?.id || null;
    const contentJson = JSON.stringify(content);

    await db.query(
      `INSERT INTO cms_content (section_key, content, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
      [key, contentJson, updatedBy]
    );

    res.status(200).json({ message: 'CMS content updated.', key, content });
  } catch (error) {
    next(error);
  }
};
