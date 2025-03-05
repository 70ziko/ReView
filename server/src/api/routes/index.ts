import express from "express";
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
} from "../controllers/product-review.js";
import { singleImageUpload } from "../../middleware/upload";

const router = express.Router();

router.post("/chat", chatHandler);
router.post("/chat/image", chatImageHandler);
router.post("/chat/clear", chatClearHandler);

router.post("/image/process", singleImageUpload, imageProcessHandler);
router.post("/prompt/process", promptProcessHandler);
router.post("/agent/image/process", singleImageUpload, agentImageProcessHandler);
router.post("/product-card/test", singleImageUpload, productCardTestHandler);

export default router;
