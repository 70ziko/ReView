import express from "express";
import {
  chatHandler,
  chatImageHandler,
  chatClearHandler,
} from "../controllers/chat.js";
import {
  imageProcessHandler,
  promptProcessHandler,
} from "../controllers/product-review.js";
import { debugSingleImageUpload } from "../../middleware/upload.js";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ message: "Welcome to the AI API" });
});

// Chat endpoints
router.post("/chat", chatHandler);
router.post("/chat/image", chatImageHandler);
router.post("/chat/clear", chatClearHandler);

// Image processing endpoint
router.post("/image/process", debugSingleImageUpload, imageProcessHandler);

// Prompt processing endpoint
router.post("/prompt/process", promptProcessHandler);

export default router;