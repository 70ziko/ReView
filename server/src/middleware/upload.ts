import multer from 'multer';

const memoryStorage = multer.memoryStorage();

// Most permissive file filter - accept anything
const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('Processing file:', file.originalname, file.mimetype);
  cb(null, true);
};

// in operating memory storage
export const memoryUpload = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

export const singleImageUpload = memoryUpload.single('image');

export const debugSingleImageUpload = (req: any, res: any, next: any) => {
  console.log('Starting upload process...');
  console.log('Content-Type:', req.headers['content-type']);
  
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
    
    if (req.file) {
      console.log('File upload success:', req.file.originalname);
    } else {
      console.log('No file received, body keys:', Object.keys(req.body || {}));
    }
    
    next();
  });
};