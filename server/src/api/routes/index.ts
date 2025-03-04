import express, { Request, Response, RequestHandler } from "express";
import { chatHandler, chatImageHandler, chatClearHandler } from "../controllers/chat.js";
import { imageProcessHandler, promptProcessHandler } from "../controllers/product-review.js";

const router = express.Router();

router.get("/", ((_req: Request, res: Response) => {
  res.send("Hello, World!");
}) as RequestHandler);

router.get("/health", ((_req: Request, res: Response) => {
  res.status(200).json({ status: "OK" });
}) as RequestHandler);


router.post("/chat", chatHandler);
router.post("/chat/image", chatImageHandler);
router.post("/chat/clear", chatClearHandler);
router.post("/image/process", imageProcessHandler);
router.post("/prompt/process", promptProcessHandler);

export default router;
