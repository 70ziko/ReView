import express from "express";
import multer from "multer";
import {
  chatHandler,
  chatImageHandler,
  chatClearHandler,
} from "../controllers/chat.js";
import {
  imageProcessHandler,
  promptProcessHandler,
} from "../controllers/product-review.js";
import { debugSingleImageUpload } from "../../middleware/upload";

const router = express.Router();

router.post("/chat", chatHandler);
router.post("/chat/image", chatImageHandler);
router.post("/chat/clear", chatClearHandler);

// Error handling middleware for multer errors
const handleMulterError = (
  err: Error | multer.MulterError,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
  next();
};

router.post("/image/process", debugSingleImageUpload, handleMulterError, imageProcessHandler);
router.post("/prompt/process", promptProcessHandler);

export default router;
