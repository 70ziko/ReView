import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ConversationMemory } from "../memory/conversation-memory.js";
// import { createRagTools } from "../tools/rag-tools.js";
import { createGraphTools } from "../tools/graph-tools.js";
import { createSearchTools } from "../tools/search-tools.js";
import {
  AGENT_CONFIG,
  EMBEDDINGS_CONFIG,
  LLM_CONFIG,
  ASSISTANT_SYSTEM_MESSAGE,
} from "./constants.js";
import { LangTools } from "../tools/types.js";

export class ChatProductAssistant {
  private llm: ChatOpenAI;
  private embeddingsModel: OpenAIEmbeddings;
  private tools: LangTools;
  private executor: AgentExecutor | null = null;
  private memory: ConversationMemory | null = null;

  constructor() {
    this.llm = new ChatOpenAI(LLM_CONFIG);
    this.embeddingsModel = new OpenAIEmbeddings(EMBEDDINGS_CONFIG);

    const toolDeps = { embeddingsModel: this.embeddingsModel };
    this.tools = [
      // ...createRagTools(toolDeps),
      ...createGraphTools(toolDeps),
      createSearchTools(toolDeps)[1], // Only use the google_lens tool
    ];
  }

  async initializeChat(userId: string, productData: any): Promise<void> {
    await this.clearHistory(userId);
    this.memory = ConversationMemory.getMemory(userId);
    this.memory.initializeWithProductContext(productData);
  }

  async initialize(userId: string): Promise<void> {
    if (this.executor) return;

    const formattedSystemMessage = SystemMessagePromptTemplate.fromTemplate(
      ASSISTANT_SYSTEM_MESSAGE
    );

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

    const memory = ConversationMemory.getMemory(userId);

    this.executor = AgentExecutor.fromAgentAndTools({
      agent,
      tools: this.tools,
      memory: memory,
      ...AGENT_CONFIG,
    });
  }

  /**
   * Process a user message and return a response
   * @param userId The user's unique identifier
   * @param message The user's message
   * @param callback Optional callback function for streaming responses
   */
  async processMessage(
    userId: string,
    message: string,
    callback?: (chunk: string) => void
  ): Promise<string> {
    try {
      if (!this.executor) {
        await this.initialize(userId);
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
   * @param userId The user's unique identifier
   * @param message The user's message
   * @param imageData URL or base64 data of the image
   * @param callback Optional callback function for streaming responses
   */
  async processMessageWithImage(
    userId: string,
    message: string,
    imageData: string,
    callback?: (chunk: string) => void
  ): Promise<string> {
    try {
      if (!this.executor) {
        await this.initialize(userId);
      }

      const input = {
        input: message,
        image: imageData, // image URL or base64 string
      };

      if (callback) {
        // For streaming mode
        const result = await this.executor!.invoke(input, {
          callbacks: [
            {
              handleLLMNewToken(token: string) {
                callback(token);
              },
            },
          ],
        });
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
   * Clear the conversation history for a specific user
   * @param userId The user's unique identifier
   */
  async clearHistory(userId: string): Promise<void> {
    ConversationMemory.clearMemory(userId);
    this.executor = null; // Force re-initialization with new memory
  }
}
