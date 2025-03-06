import { ChatOpenAI } from "@langchain/openai";
// import { OpenAIEmbeddings } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ResponseFormatter } from "./response-formatter";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
// import { createProductTools } from "../tools/product-tools.js";
// import { createNetworkTools } from "../tools/network-tools.js";
// import { createSearchTools } from "../tools/search-tools.js";
import {
  AGENT_CONFIG,
  // EMBEDDINGS_CONFIG,
  LLM_CONFIG,
  ASSISTANT_SYSTEM_MESSAGE,
} from "./constants.js";
import { LangTools } from "../tools/types";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatGeneration } from "@langchain/core/outputs";

export class ProductCardAgent {
  private baseLlm: ChatOpenAI;
  private structuredLlm: any; // Using any temporarily to avoid type issues
  // private embeddingsModel: OpenAIEmbeddings;
  private tools: LangTools;
  private parser: StructuredOutputParser<typeof ResponseFormatter>;
  private executor: AgentExecutor | null = null;

  constructor() {
    this.baseLlm = new ChatOpenAI({
      ...LLM_CONFIG,
      // modelName: "gpt-4-1106-preview",
      temperature: 0,
    });

    this.parser = new StructuredOutputParser(ResponseFormatter);
    this.structuredLlm = this.baseLlm.withStructuredOutput(this.parser, {
      name: "research_format_product_card",
      method: "jsonSchema",
      strict: true,
    });

    // this.embeddingsModel = new OpenAIEmbeddings(EMBEDDINGS_CONFIG);

    // const toolDeps = { embeddingsModel: this.embeddingsModel };
    this.tools = [
      // ...createProductTools(toolDeps),
      // ...createNetworkTools(toolDeps),
      // createSearchTools(toolDeps)[1], // Only use the google_lens tool
    ];
  }

  async initialize(): Promise<void> {
    if (this.executor) return;

    const formattedSystemMessage = SystemMessagePromptTemplate.fromTemplate(
      ASSISTANT_SYSTEM_MESSAGE
    );

    const prompt = ChatPromptTemplate.fromMessages([
      formattedSystemMessage,
      ["user", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = await createOpenAIToolsAgent({
      llm: this.structuredLlm,
      tools: this.tools,
      prompt: prompt,
    });

    this.executor = AgentExecutor.fromAgentAndTools({
      agent,
      tools: this.tools,
      ...AGENT_CONFIG,
    });
  }

  /**
   * Process a user message and return a response
   * @param message The user's message
   * @param callback Optional callback function for streaming responses
   */
  async processMessage(
    message: string,
    callback?: (chunk: string) => void
  ): Promise<string> {
    try {
      if (!this.executor) {
        await this.initialize();
      }

      let result;
      if (callback) {
        // Streaming mode
        let streamedResponse = "";
        result = await this.executor!.invoke(
          { input: message },
          {
            callbacks: [
              {
                handleLLMNewToken(chunk: string) {
                  streamedResponse += chunk;
                  callback(chunk);
                },
              },
            ],
          }
        );

        // Validate final streamed response
        try {
          return streamedResponse;
        } catch (e) {
          console.error("Streamed response validation failed:", e);
          // If streaming response is invalid, fall back to the final result
          return result.output;
        }
      } else {
        // Non-streaming mode
        result = await this.executor!.invoke({ input: message });
        return result.output;
      }
    } catch (error) {
      console.error("Error processing message:", error);
      // Return a properly formatted error response
      return JSON.stringify({
        product_name: "Error",
        score: 0,
        image_url: "",
        general_review:
          "Sorry, I encountered an error while processing your request.",
        amazon_reviews_ref: [],
        alternatives: [],
        prices: { min: 0, avg: 0 },
        product_id: "",
        category: "error",
      });
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
        image: imageData, // image URL or base64 string
      };

      let result;
      if (callback) {
        // Streaming mode
        let streamedResponse = "";
        result = await this.executor!.invoke(input, {
          callbacks: [
            {
              handleLLMNewToken(token: string) {
                streamedResponse += token;
                callback(token);
              },
            },
          ],
        });

        // Validate final streamed response
        try {
          return streamedResponse;
        } catch (e) {
          console.error("Streamed response validation failed:", e);
          // If streaming response is invalid, fall back to the final result
          return result.output;
        }
      } else {
        // Non-streaming mode
        result = await this.executor!.invoke(input);
        return result.output;
      }
    } catch (error) {
      console.error("Error processing message with image:", error);
      // Return a properly formatted error response
      return JSON.stringify({
        product_name: "Error",
        score: 0,
        image_url: "",
        general_review:
          "Sorry, I encountered an error while processing your request with the provided image.",
        amazon_reviews_ref: [],
        alternatives: [],
        prices: { min: 0, avg: 0 },
        product_id: "",
        category: "error",
      });
    }
  }
}
