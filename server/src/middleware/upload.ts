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
  console.log('Processing file:', file.originalname);
  console.log('File details:', {
    mimetype: file.mimetype,
    originalname: file.originalname,
    fieldname: file.fieldname,
    size: file.size
  });

  // More permissive check for image files
  if (file.mimetype.startsWith('image/') || 
      file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    console.log('File accepted:', file.originalname);
    cb(null, true);
  } else {
    console.log('File rejected:', file.originalname);
    cb(new Error('Invalid file type. Only image files are allowed.'));
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
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Request body:', req.body);
  
  singleImageUpload(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      console.error('Error stack:', err.stack);
    } else if (req.file) {
      console.log('Upload successful:');
      console.log('- Original name:', req.file.originalname);
      console.log('- Mime type:', req.file.mimetype);
      console.log('- Size:', req.file.size, 'bytes');
      console.log('- Field name:', req.file.fieldname);
    } else {
      console.log('No file was uploaded');
      console.log('Request body after multer:', req.body);
    }
    next(err);
  });
};
