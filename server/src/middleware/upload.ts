import multer from 'multer';
import path from 'path';

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// In-memory storage configuration (no files saved to disk)
const memoryStorage = multer.memoryStorage();

// Filter for allowing only images
const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Create multer instances
export const diskUpload = multer({ 
  storage: storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export const memoryUpload = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Export middleware functions for different upload scenarios
export const singleImageUpload = memoryUpload.single('image');
export const multipleImagesUpload = memoryUpload.array('images', 5); // Maximum 5 images