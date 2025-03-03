import { RagChatAssistant } from './agent/rag-chat-assistant.js';

// Singleton instance
export const ragChatAssistant = new RagChatAssistant();
void ragChatAssistant.initialize();

export * from './tools/types.js';
export * from './memory/conversation-memory.js';
export { RagChatAssistant } from './agent/rag-chat-assistant.js';

// export { SYSTEM_MESSAGE, LLM_CONFIG, EMBEDDINGS_CONFIG, AGENT_CONFIG } from './agent/constants.js';
