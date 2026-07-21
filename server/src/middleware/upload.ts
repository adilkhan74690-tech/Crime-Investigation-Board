import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ApiError } from '../utils/apiError';

const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${fileExt}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB maximum limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4'
    ];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Unsupported file format. Supported: Images (JPG, PNG, WEBP), PDF, DOC/DOCX, MP4 video.') as any, false);
    }
  }
});

export { upload as uploadMiddleware };
