import { RagChatAssistant } from "./agent/rag-chat-assistant.js";
import { GraphRagAgent } from "./agent/graph-rag-agent.js";

// Singleton instances for performance, chats are stored in conversation memories
export const ragChatAssistant = new RagChatAssistant();
void ragChatAssistant.initialize("system"); // Use 'system' as default userId for initial setup

export const graphRagAgent = new GraphRagAgent();
void graphRagAgent.initialize();

export * from "./tools/types.js";
export * from "./memory/conversation-memory.js";
export { RagChatAssistant } from "./agent/rag-chat-assistant.js";

// export { SYSTEM_MESSAGE, LLM_CONFIG, EMBEDDINGS_CONFIG, AGENT_CONFIG } from './agent/constants.js';
