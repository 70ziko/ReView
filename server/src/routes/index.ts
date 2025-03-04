import express, { Request, Response, RequestHandler } from "express";
import { ragChatAssistant } from "../lib/ai/index.js";
import { RequestWithSession, ProductResponse } from "./types.js";

const router = express.Router();

// Basic routes
router.get("/", ((_req: Request, res: Response) => {
  res.send("Hello, World!");
}) as RequestHandler);

router.get("/health", ((_req: Request, res: Response) => {
  res.status(200).json({ status: "OK" });
}) as RequestHandler);

// Chat routes
const chatHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    const { message } = request.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const response = await ragChatAssistant.processMessage(request.session.userId, message);
    res.json({ response });
  } catch (error) {
    console.error("Error processing chat message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
};

const chatImageHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    const { message, imageData } = request.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (!imageData) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    const response = await ragChatAssistant.processMessageWithImage(
      request.session.userId,
      message,
      imageData
    );

    res.json({ response });
  } catch (error) {
    console.error("Error processing image chat message:", error);
    res.status(500).json({ error: "Failed to process message with image" });
  }
};

const chatClearHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    await ragChatAssistant.clearHistory(request.session.userId);
    res.json({ status: "success", message: "Chat history cleared" });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
};

// Product review routes
const imageProcessHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    const { imageData } = request.body;

    if (!imageData) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }
    
    await ragChatAssistant.clearHistory(request.session.userId);

    // In a real implementation, this would process the image
    // Here we're returning dummy data
    const dummyResponse: ProductResponse = {
      product_name: "Premium Bluetooth Headphones",
      score: 3,
      image_url: "https://example.com/images/headphones.jpg",
      general_review:
        "High-quality wireless headphones with excellent sound quality and comfortable fit. Battery life could be improved.",
      amazon_reviews_ref: "https://amazon.com/product/123456/reviews",
      alternatives: [
        {
          name: "Budget Bluetooth Headphones",
          product_id: "BT78901",
          score: 4,
        },
        {
          name: "Premium Wired Headphones",
          product_id: "WH45678",
          score: 4,
        },
      ],
      prices: {
        min: 79.99,
        avg: 94.5,
      },
      product_id: "BT12345",
      category: "Electronics/Audio/Headphones",
    };

    await ragChatAssistant.initializeChat(request.session.userId, dummyResponse);
    res.json(dummyResponse);
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
};

const promptProcessHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    const { prompt } = request.body;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required in request body" });
      return;
    }

    await ragChatAssistant.clearHistory(request.session.userId);

    const dummyResponse: ProductResponse = {
      product_name: "Smart Home Security Camera",
      score: 4,
      image_url: "https://example.com/images/security-camera.jpg",
      general_review:
        "High-definition security camera with motion detection and night vision. Easy to set up with smartphone integration. Some users report occasional connectivity issues.",
      amazon_reviews_ref: "https://amazon.com/product/789012/reviews",
      alternatives: [
        {
          name: "Budget Security Camera",
          product_id: "SC34567",
          score: 3,
        },
        {
          name: "Premium Doorbell Camera",
          product_id: "DC12345",
          score: 5,
        },
      ],
      prices: {
        min: 119.99,
        avg: 149.99,
      },
      product_id: "SC56789",
      category: "Electronics/SmartHome/Security",
    };

    await ragChatAssistant.initializeChat(request.session.userId, dummyResponse);
    res.json(dummyResponse);
  } catch (error) {
    console.error("Error processing prompt:", error);
    res.status(500).json({ error: "Failed to process prompt" });
  }
};

// Route handlers
router.post("/chat", chatHandler);
router.post("/chat/image", chatImageHandler);
router.post("/chat/clear", chatClearHandler);
router.post("/image/process", imageProcessHandler);
router.post("/prompt/process", promptProcessHandler);

export default router;
