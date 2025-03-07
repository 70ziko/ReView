import express from "express";
import multer from "multer";
import {
  chatHandler,
  chatImageHandler,
  chatClearHandler,
} from "../controllers/chat.js";
import {
  agentImageProcessHandler,
  imageProcessHandler,
  promptProcessHandler,
  productCardTestHandler,
  imageProductCardHandler,
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
router.post("/agent/image/process", debugSingleImageUpload, handleMulterError, agentImageProcessHandler);
router.post("/product-card/test", debugSingleImageUpload, handleMulterError, productCardTestHandler);
router.post('/product-card/image', debugSingleImageUpload, handleMulterError, imageProductCardHandler);

export default router;
