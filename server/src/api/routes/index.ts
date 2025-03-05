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

const router = express.Router();

router.post("/chat", chatHandler);
router.post("/chat/image", chatImageHandler);
router.post("/chat/clear", chatClearHandler);
router.post("/image/process", imageProcessHandler);
router.post("/prompt/process", promptProcessHandler);

export default router;
