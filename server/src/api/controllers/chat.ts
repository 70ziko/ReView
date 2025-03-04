import { RequestHandler } from "express";
import { RequestWithSession } from "../routes/types";
import { ragChatAssistant } from "../../lib/ai";

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

export { chatHandler, chatImageHandler, chatClearHandler };