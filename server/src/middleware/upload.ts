import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage for temporary file handling
const memoryStorage = multer.memoryStorage();

// Most permissive file filter - accept anything
const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('Processing file:', file.originalname, file.mimetype);
  // Accept any file for now to debug the upload process
  cb(null, true);
};

// Configure multer with memory storage
export const memoryUpload = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Simple middleware for single image upload
export const singleImageUpload = memoryUpload.single('image');

// Debug middleware that wraps the actual upload
export const debugSingleImageUpload = (req: any, res: any, next: any) => {
  console.log('Starting upload process...');
  console.log('Content-Type:', req.headers['content-type']);
  
  // Call the actual upload middleware
  singleImageUpload(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
          error: `Upload error: ${err.message}`, 
          code: err.code 
        });
      }
      return res.status(500).json({ error: err.message });
    }
    
    // Log the upload result
    if (req.file) {
      console.log('File upload success:', req.file.originalname);
    } else {
      console.log('No file received, body keys:', Object.keys(req.body || {}));
    }
    
    next();
  });
};