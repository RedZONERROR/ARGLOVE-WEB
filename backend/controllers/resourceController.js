const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;

async function userIsAdmin(userId) {
  const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
  return users.length > 0 && users[0].role === 'admin';
}

async function canUploadResource(userId, ownerType, ownerId) {
  if (ownerType === 'User' && ownerId === userId) {
    return true;
  }
  return userIsAdmin(userId);
}

async function canDeleteResource(userId, resource) {
  if (resource.owner_type === 'User' && resource.owner_id === userId) {
    return true;
  }
  return userIsAdmin(userId);
}

exports.uploadResource = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'No file uploaded.' } });
  }

    const { owner_type, owner_id, file_role = 'gallery', sort_order = 0 } = req.body;

  if (!owner_type || !owner_id) {
    const tempPath = path.join(__dirname, '..', 'public', 'uploads', req.file.filename);
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      console.error(e);
    }
    return res.status(400).json({ error: { message: 'owner_type and owner_id are required.' } });
  }

  try {
    const cleanOwnerId = parseInt(owner_id, 10);
    const allowed = await canUploadResource(req.user.id, owner_type, cleanOwnerId);
    if (!allowed) {
      const tempPath = path.join(__dirname, '..', 'public', 'uploads', req.file.filename);
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.error(e);
      }
      return res.status(403).json({ error: { message: 'You are not authorized to upload to this resource.' } });
    }

    let ownerExists = false;
    if (owner_type === 'Product') {
      const [rows] = await db.query('SELECT id FROM products WHERE id = ?', [cleanOwnerId]);
      ownerExists = rows.length > 0;
    } else if (owner_type === 'Blog') {
      const [rows] = await db.query('SELECT id FROM blogs WHERE id = ?', [cleanOwnerId]);
      ownerExists = rows.length > 0;
    } else if (owner_type === 'User') {
      const [rows] = await db.query('SELECT id FROM users WHERE id = ?', [cleanOwnerId]);
      ownerExists = rows.length > 0;
    }

    if (!ownerExists) {
      const tempPath = path.join(__dirname, '..', 'public', 'uploads', req.file.filename);
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.error(e);
      }
      return res.status(400).json({ error: { message: `Owner entity (${owner_type} with ID ${cleanOwnerId}) not found.` } });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const [result] = await db.query(
      'INSERT INTO resources (file_url, file_name, mime_type, owner_type, owner_id, file_role, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [fileUrl, req.file.filename, req.file.mimetype, owner_type, cleanOwnerId, file_role, parseInt(sort_order, 10) || 0]
    );

    res.status(201).json({
      message: 'Resource uploaded and registered successfully.',
      resource: {
        id: result.insertId,
        file_url: fileUrl,
        file_name: req.file.filename,
        mime_type: req.file.mimetype,
        owner_type,
        owner_id: cleanOwnerId,
        file_role,
        sort_order: parseInt(sort_order, 10) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteResource = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [resources] = await db.query('SELECT * FROM resources WHERE id = ?', [id]);
    if (resources.length === 0) {
      return res.status(404).json({ error: { message: 'Resource not found.' } });
    }

    const resource = resources[0];
    const allowed = await canDeleteResource(req.user.id, resource);
    if (!allowed) {
      return res.status(403).json({ error: { message: 'You are not authorized to delete this resource.' } });
    }

    const filePath = path.join(__dirname, '..', 'public', 'uploads', resource.file_name);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Physical file deletion failed for ${resource.file_name}:`, error.message);
    }

    await db.query('DELETE FROM resources WHERE id = ?', [id]);

    res.status(200).json({ message: 'Resource deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
