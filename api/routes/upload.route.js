import express from 'express';
import multer from 'multer';
import { verifyToken } from '../utils/verifyUser.js';
import { storeImage } from '../utils/objectStorage.js';

const router = express.Router();

const ALLOWED_TYPES = new Map([
  ['image/jpeg', { ext: '.jpg', signature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ['image/png', { ext: '.png', signature: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ['image/gif', { ext: '.gif', signature: (b) => b.length >= 6 && (b.subarray(0, 6).toString() === 'GIF87a' || b.subarray(0, 6).toString() === 'GIF89a') }],
  ['image/webp', { ext: '.webp', signature: (b) => b.length >= 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' }],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
  },
});

router.post('/', verifyToken, upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const type = ALLOWED_TYPES.get(req.file.mimetype);
  if (!type || !type.signature(req.file.buffer)) {
    return res.status(400).json({ success: false, message: 'The uploaded file is not a valid supported image.' });
  }

  try {
    const url = await storeImage({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      extension: type.ext,
    });
    return res.status(200).json({ success: true, url });
  } catch (error) {
    return next(error);
  }
});

export default router;
