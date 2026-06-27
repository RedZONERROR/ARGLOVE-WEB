const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const IMAGE_MIMES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const VIDEO_MIMES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const ALL_MIMES = { ...IMAGE_MIMES, ...VIDEO_MIMES };

const IMAGE_MAGIC = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

function matchesMagicBytes(buffer, mimeType) {
  const expected = IMAGE_MAGIC[mimeType];
  if (!expected || !buffer || buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = ALL_MIMES[file.mimetype] || path.extname(file.originalname) || '.bin';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALL_MIMES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WEBP, MP4, WEBM.'), false);
  }
};

const uploadMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function validateUploadedMedia(req, res, next) {
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];
  for (const file of files) {
    if (IMAGE_MIMES[file.mimetype]) {
      try {
        const buffer = fs.readFileSync(file.path);
        if (!matchesMagicBytes(buffer, file.mimetype)) {
          fs.unlink(file.path, () => {});
          return res.status(400).json({ error: { message: 'Invalid image file content.' } });
        }
      } catch (err) {
        return next(err);
      }
    }
  }
  next();
}

module.exports = {
  uploadMedia,
  validateUploadedMedia,
  IMAGE_MIMES,
  VIDEO_MIMES,
  isVideoMime: (mime) => Boolean(VIDEO_MIMES[mime]),
};
