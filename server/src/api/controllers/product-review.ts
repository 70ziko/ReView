import { RequestHandler } from "express";
import { ProductResponse, RequestWithSession } from "../routes/types";
import { chatProductAssistant, productCardAgent } from "../../lib/ai";
import serpGoogleLens from "../../services/serp-google-lens";
import { parseGoogleLensInput } from "../../lib/parsers/image-data";

const imageProcessHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  try {
    const { 
      image: imageData,
      message = "Create a comprehensive product card for this image, including accurate information about features, pricing, and alternatives."
    } = req.body;

    if (!imageData) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }
    console.log('Received image data:', imageData);

    let response;
    if (imageData) {
      response = await productCardAgent.processMessageWithImage(message, JSON.stringify(imageData));
    } else {
      response = await productCardAgent.processMessage(message);
    }

    const parsedResponse = JSON.parse(response as string);

    await chatProductAssistant.clearHistory(request.session.userId);
    await chatProductAssistant.initializeChat(
      request.session.userId,
      parsedResponse

    );

    res.json(parsedResponse);
  } catch (error) {
    console.error("Error processing product card request:", error);
    res.status(500).json({
      product_name: "Error",
      score: 0,
      image_url: "",
      general_review: "Failed to process the request",
      amazon_reviews_ref: [],
      alternatives: [],
      prices: { min: 0, avg: 0 },
      product_id: "",
      category: "error"
    });
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

export {
  imageProcessHandler,
  promptProcessHandler,
};
