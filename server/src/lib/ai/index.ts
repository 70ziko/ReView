import { ChatProductAssistant } from "./agents/chat-product-assistant.js";
import { ProductCardAgent } from "./agents/product-card-agent.js";

// Singleton instances for performance, chats are stored in conversation memories
export const chatProductAssistant = new ChatProductAssistant();
void chatProductAssistant.initialize("system"); // Use 'system' as default userId for initial setup

export const productCardAgent = new ProductCardAgent();
// void productCardAgent.initialize();

export * from "./tools/types.js";
export * from "./memory/conversation-memory.js";
export { ChatProductAssistant } from "./agents/chat-product-assistant.js";

// export { SYSTEM_MESSAGE, LLM_CONFIG, EMBEDDINGS_CONFIG, AGENT_CONFIG } from './agent/constants.js';
