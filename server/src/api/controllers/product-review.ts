import { RequestHandler } from "express";
import { RequestWithSession } from "../routes/types";
import { chatProductAssistant, productCardAgent } from "../../lib/ai";

const imageProcessHandler: RequestHandler = async (req, res) => {
  const request = req as RequestWithSession;
  
  console.log('Image process request received');
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }
    
    console.debug(`Processing file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);
    
    const message = req.body && req.body.message 
      ? req.body.message 
      : "Create a comprehensive product card for this image, including accurate information about features, pricing, and alternatives.";
    
    const imageData = {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer.toString('base64')
    };
    
    console.info('Sending to AI for processing...');
    
    const response = await productCardAgent.processMessageWithImage(
      message, 
      JSON.stringify(imageData.buffer)
    );
    
    console.debug('AI response:', response);
    console.info('AI processing complete, parsing response');
    
    const parsedResponse = JSON.parse(response as string);
    
    await chatProductAssistant.clearHistory(request.session.userId);
    await chatProductAssistant.initializeChat(
      request.session.userId,
      parsedResponse
    );
    
    console.info('Successfully processed image, returning response');
    return res.json(parsedResponse);
    
  } catch (error) {
    console.error("Error processing product card request:", error);
    return res.status(500).json({
      product_name: "Error",
      score: 0,
      image_url: "",
      general_review: "Failed to process the request: " + (error instanceof Error ? error.message : "Unknown error"),
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
    const response = await productCardAgent.processMessage(
      prompt, 
    );
    
    console.debug('AI response:', response);
    console.info('AI processing complete, parsing response');
    
    const parsedResponse = JSON.parse(response as string);
    
    await chatProductAssistant.clearHistory(request.session.userId);
    await chatProductAssistant.initializeChat(
      request.session.userId,
      parsedResponse
    );
    res.json(response);
  } catch (error) {
    console.error("Error processing prompt:", error);
    res.status(500).json({ error: "Failed to process prompt" });
  }
};

export { imageProcessHandler, promptProcessHandler };