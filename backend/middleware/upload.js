const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const MAGIC_BYTES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

function matchesMagicBytes(buffer, mimeType) {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected || !buffer || buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = MIME_TO_EXT[file.mimetype] || '.bin';
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = Object.keys(MIME_TO_EXT);
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

function validateUploadedImage(req, res, next) {
  if (!req.file) return next();

  const ext = MIME_TO_EXT[req.file.mimetype];
  if (!ext) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: { message: 'Invalid file type.' } });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    if (!matchesMagicBytes(buffer, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { message: 'File content does not match declared image type.' } });
    }
  } catch (err) {
    return next(err);
  }

  next();
}

module.exports = upload;
module.exports.validateUploadedImage = validateUploadedImage;
