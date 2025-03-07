import multer from 'multer';
import path from 'path';

// Storage for uploaded files on disk
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    console.log('Destination directory:', path.join(process.cwd(), 'uploads'));
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const filename = `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

// In-memory storage configuration (no files saved to disk)
const memoryStorage = multer.memoryStorage();

// accept only images
const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('Processing file:', file.originalname, 'Type:', file.mimetype);
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log('File accepted:', file.originalname);
    cb(null, true);
  } else {
    console.log('File rejected:', file.originalname, '- Invalid type:', file.mimetype);
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

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

export const singleImageUpload = memoryUpload.single('image');
// export const multipleImagesUpload = memoryUpload.array('images', 5); // Maximum 5 images

export const debugSingleImageUpload = (req: any, res: any, next: any) => {
  console.log('Starting single image upload...');
  singleImageUpload(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err.message);
    } else if (req.file) {
      console.log('Upload successful:', req.file.originalname, 'Size:', req.file.size, 'bytes');
    } else {
      console.log('No file was uploaded');
    }
    next(err);
  });
};