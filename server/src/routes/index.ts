import { Request, Response } from "express";
import { Router } from "express";
import { ragChatAssistant } from "../lib/ai/index.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.send("Hello, World!");
});

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK" });
});

router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const response = await ragChatAssistant.processMessage(message);
    res.json({ response });
  } catch (error) {
    console.error("Error processing chat message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

router.post(
  "/chat/image",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, imageData } = req.body;

      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }
      if (!imageData) {
        res.status(400).json({ error: "Image data is required" });
        return;
      }

      const response = await ragChatAssistant.processMessageWithImage(
        message,
        imageData
      );

      res.json({ response });
    } catch (error) {
      console.error("Error processing image chat message:", error);
      res.status(500).json({ error: "Failed to process message with image" });
    }
  }
);

router.post(
  "/chat/clear",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await ragChatAssistant.clearHistory();
      res.json({ status: "success", message: "Chat history cleared" });
    } catch (error) {
      console.error("Error clearing chat history:", error);
      res.status(500).json({ error: "Failed to clear chat history" });
    }
  }
);

// Dummy route for image processing and product information
router.post(
  "/image/process",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { imageData } = req.body;

      if (!imageData) {
        res.status(400).json({ error: "Image data is required" });
        return;
      }
      // In a real implementation, this would process the image
      // Here we're returning dummy data

      const dummyResponse = {
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

      setTimeout(() => {
        res.json(dummyResponse);
      }, 1500); // delay, to simulate processing time, NEEDS A SPINNER ON UI!
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  }
);

// Dummy route for image processing and product information
router.post(
  "/prompt/process",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { prompt } = req.body;

      if (!prompt) {
        res.status(400).json({ error: "Prompt is required in request body" });
        return;
      }
      // In a real implementation, this would process the image
      // Here we're returning dummy data

      // Create a different example response based on the prompt
      const dummyResponse = {
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

      setTimeout(() => {
        res.json(dummyResponse);
      }, 1500); // delay, to simulate processing time, NEEDS A SPINNER ON UI!
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  }
);

export default router;
