import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { ConversationMemory } from '../memory/conversation-memory.js';
import { createProductTools } from '../tools/product-tools.js';
import { createNetworkTools } from '../tools/network-tools.js';
import { createSearchTools } from '../tools/search-tools.js';
import { AGENT_CONFIG, EMBEDDINGS_CONFIG, LLM_CONFIG, ASSISTANT_SYSTEM_MESSAGE } from './constants.js';
import { GraphRagTools } from '../tools/types.js';

export class ReviewWorkflowAgent {
    private llm: ChatOpenAI;
    private embeddingsModel: OpenAIEmbeddings;
    private tools: GraphRagTools;
    private memory: ConversationMemory;
    private executor: AgentExecutor | null = null;
    
    constructor() {
        this.llm = new ChatOpenAI(LLM_CONFIG);
        this.embeddingsModel = new OpenAIEmbeddings(EMBEDDINGS_CONFIG);
        
        const toolDeps = { embeddingsModel: this.embeddingsModel };
        this.tools = [
            ...createProductTools(toolDeps),
            ...createNetworkTools(toolDeps),
            ...[createSearchTools(toolDeps)[1]], // Only google_lens tool
        ];
        
        this.memory = new ConversationMemory();
        this.memory.memoryKey = "history"; 
        this.memory.returnMessages = true; 
    }
    
    async initialize(): Promise<void> {
        if (this.executor) return;
        
        const formattedSystemMessage = SystemMessagePromptTemplate.fromTemplate(ASSISTANT_SYSTEM_MESSAGE);        

        const prompt = ChatPromptTemplate.fromMessages([
            formattedSystemMessage,
            new MessagesPlaceholder("history"), 
            ["user", "{input}"],
            new MessagesPlaceholder("agent_scratchpad"),
        ]);
        
        const agent = await createOpenAIToolsAgent({
            llm: this.llm,
            tools: this.tools,
            prompt: prompt,
        });
        
        this.executor = AgentExecutor.fromAgentAndTools({
            agent,
            tools: this.tools,
            memory: this.memory,
            ...AGENT_CONFIG
        });
    }
    
    /**
     * Process a user message and return a response
     * @param message The user's message
     * @param callback Optional callback function for streaming responses
     */
    async processMessage(message: string, callback?: (chunk: string) => void): Promise<string> {
        try {
            if (!this.executor) {
                await this.initialize();
            }
            
            if (callback) {
                // Streaming mode
                const result = await this.executor!.invoke(
                    { input: message },
                    {
                        callbacks: [
                            {
                                handleLLMNewToken(chunk: string) {
                                    callback(chunk);
                                },
                            },
                        ],
                    }
                );
                return result.output;
            } else {
                // Non-streaming mode
                const result = await this.executor!.invoke({ input: message });
                return result.output;
            }
        } catch (error) {
            console.error("Error processing message:", error);
            return "Sorry, I encountered an error while processing your request.";
        }
    }
    /**
     * Process an image along with a message
     * @param message The user's message
     * @param imageData URL or base64 data of the image
     * @param callback Optional callback function for streaming responses
     */
    async processMessageWithImage(
        message: string,
        imageData: string,
        callback?: (chunk: string) => void
    ): Promise<string> {
        try {
            if (!this.executor) {
                await this.initialize();
            }

            const input = {
                input: message,
                image: imageData // image URL or base64 string
            };
            
            if (callback) {
                // For streaming mode
                const result = await this.executor!.invoke(
                    input,
                    {
                        callbacks: [
                            {
                                handleLLMNewToken(token: string) {
                                    callback(token);
                                },
                            },
                        ],
                    }
                );  
                return result.output;
            } else {
                // Non-streaming mode
                const result = await this.executor!.invoke(input);
                return result.output;
            }
        } catch (error) {
            console.error("Error processing message with image:", error);
            return "Sorry, I encountered an error while processing your request.";
        }
    }
    
    /**
     * Clear the conversation history
     */
    async clearHistory(): Promise<void> {
        if (this.memory) await this.memory.clear();
    }
}
