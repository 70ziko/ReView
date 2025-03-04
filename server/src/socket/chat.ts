import { Server, Socket } from "socket.io";
import { RagChatAssistant } from "../lib/ai/index.js";
import { SessionSocket } from "./types.js";
import { ConversationMemory } from "../lib/ai/memory/conversation-memory.js";

export function setupChatSocket(
  io: Server,
  ragChatAssistant: RagChatAssistant
) {
  io.on("connection", (socket: Socket) => {
    const sessionSocket = socket as SessionSocket;
    const session = sessionSocket.request.session;
    console.log(`Client connected: ${socket.id}`);

    if (!session.userId) {
      session.userId =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      session.save();
    }

    sessionSocket.on("chat:message", async (data: { message: string }) => {
      try {
        session.save();

        await ragChatAssistant.processMessage(
          session.userId,
          data.message,
          (chunk) => {
            sessionSocket.emit("chat:response:chunk", { chunk });
          }
        );

        sessionSocket.emit("chat:response:done");
      } catch (error) {
        console.error("Error processing chat message:", error);
        sessionSocket.emit("chat:error", {
          error: "Failed to process your message",
        });
      }
    });

    sessionSocket.on(
      "chat:message:image",
      async (data: { message: string; imageData: string }) => {
        try {
          session.save();

          await ragChatAssistant.processMessageWithImage(
            session.userId,
            data.message,
            data.imageData,
            (chunk) => {
              sessionSocket.emit("chat:response:chunk", { chunk });
            }
          );

          sessionSocket.emit("chat:response:done");
        } catch (error) {
          console.error("Error processing chat message with image:", error);
          sessionSocket.emit("chat:error", {
            error: "Failed to process your message with image",
          });
        }
      }
    );

    sessionSocket.on("chat:clear", async () => {
      try {
        await ragChatAssistant.clearHistory(session.userId);
        session.save();
        sessionSocket.emit("chat:cleared");
      } catch (error) {
        console.error("Error clearing chat history:", error);
        sessionSocket.emit("chat:error", {
          error: "Failed to clear chat history",
        });
      }
    });

    sessionSocket.on("chat:get_history", async () => {
      try {
        const memory = ConversationMemory.getMemory(session.userId);
        const { history } = await memory.loadMemoryVariables({});
        sessionSocket.emit("chat:history", { history });
      } catch (error) {
        console.error("Error getting chat history:", error);
        sessionSocket.emit("chat:error", {
          error: "Failed to get chat history",
        });
      }
    });

    sessionSocket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
