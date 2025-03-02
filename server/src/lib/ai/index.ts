import { GraphRagAgent } from './agent/graph-rag-agent.js';

// Singleton instance
export const graphRagAgent = new GraphRagAgent();
void graphRagAgent.initialize();

export * from './tools/types.js';
export * from './memory/conversation-memory.js';
export { GraphRagAgent } from './agent/graph-rag-agent.js';

export { SYSTEM_MESSAGE, LLM_CONFIG, EMBEDDINGS_CONFIG, AGENT_CONFIG } from './agent/constants.js';
