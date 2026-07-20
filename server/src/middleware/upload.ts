import multer from 'multer';

// Use memory storage to capture file Buffer streams
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limit file size to 10MB
  }
});
export { upload as uploadMiddleware };
