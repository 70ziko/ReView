import { RequestHandler } from "express";
import { ProductResponse, RequestWithSession } from "../routes/types";
import { chatProductAssistant, productCardAgent } from "../../lib/ai";
import serpGoogleLens from "../../services/serp-google-lens";
import { parseGoogleLensInput } from "../../lib/parsers/image-data";

const imageProcessHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    const { imageData } = request.body;

    if (!imageData) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    await chatProductAssistant.clearHistory(request.session.userId);

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

    await chatProductAssistant.initializeChat(
      request.session.userId,
      dummyResponse
    );
    res.json(dummyResponse);
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
};

const agentImageProcessHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    const { imageData } = request.body;

    if (!imageData) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    await chatProductAssistant.clearHistory(request.session.userId);
    
    const parsedImageData = parseGoogleLensInput(imageData); 
    const imageResponse = await serpGoogleLens(parsedImageData);

    const productData = await productCardAgent.processMessageWithImage(
      `Present the data from the google lens api into a product card json with a public 
      consensus on the review, prices, and present alternatives. 
      Use the tools you have available to get the information from the databas. Google lens response:
      \n${JSON.stringify(imageResponse)}`,
      imageData
    );

    await chatProductAssistant.initializeChat(
      request.session.userId,
      productData
    );

    res.json(productData);
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

    await chatProductAssistant.clearHistory(request.session.userId);

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

    await chatProductAssistant.initializeChat(
      request.session.userId,
      dummyResponse
    );
    res.json(dummyResponse);
  } catch (error) {
    console.error("Error processing prompt:", error);
    res.status(500).json({ error: "Failed to process prompt" });
  }
};

export { imageProcessHandler, promptProcessHandler, agentImageProcessHandler };
