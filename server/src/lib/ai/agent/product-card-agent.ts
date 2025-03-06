import { ChatOpenAI } from "@langchain/openai";
import { ResponseFormatter } from "./response-formatter";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import {
  LLM_CONFIG,
  EMBEDDINGS_CONFIG,
  ASSISTANT_SYSTEM_MESSAGE,
} from "./constants.js";
import { RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createProductTools } from "../tools/product-tools.js";
import { createNetworkTools } from "../tools/network-tools.js";
import { createSearchTools } from "../tools/search-tools.js";
import { LangTools, ToolDependencies } from "../tools/types";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";

// Define the expected output structure of the product card
interface ProductCardOutput {
  prices: { min: number; avg: number };
  product_id: string;
  category: string;
}

export class ProductCardAgent {
  private llm: ChatOpenAI;
  private chain: RunnableSequence;

  constructor() {
    this.llm = new ChatOpenAI({
      ...LLM_CONFIG,
      temperature: 0,
    });

    const functionName = "generate_product_card";
    const schema = {
      name: functionName,
      description: "Generate a structured product card with all relevant information",
      parameters: this.createJsonSchema(),
    };

    // Create a prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(ASSISTANT_SYSTEM_MESSAGE),
      ["human", "{input}"],
    ]);

    // Create an output parser
    const outputParser = new JsonOutputFunctionsParser<ProductCardOutput>();

    // Create the chain as a runnable sequence
    this.chain = RunnableSequence.from([
      {
        input: (i: { input: string }) => ({ input: i.input }),
      },
      prompt,
      this.llm.bind({
        functions: [schema],
        function_call: { name: functionName }
      }),
      outputParser,
    ]);
  }

  /**
   * Creates a JSON schema matching the ResponseFormatter structure
   */
  private createJsonSchema() {
    return productCardSchema;
  }

  /**
   * Process a user message and return a response
   * @param message The user's message
   * @param callback Optional callback function for streaming responses
   */
  async processMessage(
    message: string,
    callback?: (chunk: string) => void
  ): Promise<MessageContent> {
    try {
      if (callback) {
        // Streaming mode isn't directly supported with function calling
        // We'll need to handle it differently
        let result = await this.llm.invoke([
          { role: "system", content: ASSISTANT_SYSTEM_MESSAGE },
          { role: "user", content: message }
        ], {
          callbacks: [
            {
              handleLLMNewToken(chunk: string) {
                callback(chunk);
              },
            },
          ],
        });
        
        // Parse the content to ensure it matches our schema
        // try {
        //   const parsed = JSON.parse(result.content);
        //   return JSON.stringify(parsed);
        // } catch (e) {
          return result.content;
        // }
      } else {
        // Non-streaming mode
        const result = await this.chain.invoke({ input: message });
        return JSON.stringify(result);
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
  ): Promise<MessageContent> {
    try {
      // When we have an image, append it to the message
      const messageWithImage = `${message}\n\nImage: ${imageData}`;
      
      // Use the same processing logic as processMessage
      return this.processMessage(messageWithImage, callback);
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
