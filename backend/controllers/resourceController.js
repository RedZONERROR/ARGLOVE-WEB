const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;

exports.uploadResource = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'No file uploaded.' } });
  }

  const { owner_type, owner_id, file_role = 'gallery' } = req.body;

  if (!owner_type || !owner_id) {
    // Delete file if owner details are missing to avoid leaving orphan files on disk
    const tempPath = path.join(__dirname, '..', 'public', 'uploads', req.file.filename);
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      console.error(e);
    }
    return res.status(400).json({ error: { message: 'owner_type and owner_id are required.' } });
  }

  try {
    // Validate that the target owner exists
    let ownerExists = false;
    const cleanOwnerId = parseInt(owner_id, 10);

    if (owner_type === 'Product') {
      const [rows] = await db.query('SELECT id FROM products WHERE id = ?', [cleanOwnerId]);
      ownerExists = rows.length > 0;
    } else if (owner_type === 'Blog') {
      const [rows] = await db.query('SELECT id FROM blogs WHERE id = ?', [cleanOwnerId]);
      ownerExists = rows.length > 0;
    } else if (owner_type === 'User') {
      const [rows] = await db.query('SELECT id FROM users WHERE id = ?', [cleanOwnerId]);
      ownerExists = rows.length > 0;
    } else {
      ownerExists = false;
    }

    if (!ownerExists) {
      // Delete uploaded file since owner is invalid
      const tempPath = path.join(__dirname, '..', 'public', 'uploads', req.file.filename);
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.error(e);
      }
      return res.status(400).json({ error: { message: `Owner entity (${owner_type} with ID ${cleanOwnerId}) not found.` } });
    }

    // Build the resource access URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const [result] = await db.query(
      'INSERT INTO resources (file_url, file_name, mime_type, owner_type, owner_id, file_role) VALUES (?, ?, ?, ?, ?, ?)',
      [fileUrl, req.file.filename, req.file.mimetype, owner_type, cleanOwnerId, file_role]
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
        file_role
      }
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
    const filePath = path.join(__dirname, '..', 'public', 'uploads', resource.file_name);

    // Delete the file physically from the disk
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Physical file deletion failed for ${resource.file_name}:`, error.message);
      // We still continue to delete from the database to avoid state locks
    }

    // Delete the database reference
    await db.query('DELETE FROM resources WHERE id = ?', [id]);

    res.status(200).json({ message: 'Resource deleted successfully.' });

  } catch (error) {
    next(error);
  }
};
