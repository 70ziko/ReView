import { ChatOpenAI } from "@langchain/openai";
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
import { MessageContent } from "@langchain/core/messages";
import { OpenAIEmbeddings } from "@langchain/openai";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";

import { createRagTools } from "../tools/rag-tools.js";
import { createGraphTools } from "../tools/graph-tools.js";
import { createSearchTools } from "../tools/search-tools.js";
import { productCardSchema } from "../schemas/product-card-schema.js";
import { LangTools, ToolDependencies } from "../tools/types.js";
import { ProductCardOutput } from "./types.js";

export class ProductCardAgent {
  private llm: ChatOpenAI;
  private chain: RunnableSequence;
  private tools: LangTools;
  private embeddingsModel: OpenAIEmbeddings;

  constructor() {
    this.llm = new ChatOpenAI({
      ...LLM_CONFIG,
      temperature: 0,
    });

    this.embeddingsModel = new OpenAIEmbeddings(EMBEDDINGS_CONFIG);

    const toolDeps: ToolDependencies = {
      embeddingsModel: this.embeddingsModel,
    };

    this.tools = [
      ...createRagTools(toolDeps),
      ...createGraphTools(toolDeps),
      ...createSearchTools(toolDeps),
    ];

    const functionName = "generate_product_card";
    const schema = {
      name: functionName,
      description:
        "Generate a structured product card with all relevant information",
      parameters: this.createJsonSchema(),
    };

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(ASSISTANT_SYSTEM_MESSAGE),
      ["human", "{input}"],
    ]);

    const outputParser = new JsonOutputFunctionsParser<ProductCardOutput>();

    this.chain = RunnableSequence.from([
      {
        input: (i: { input: string }) => ({ input: i.input }),
      },
      prompt,
      this.llm.bind({
        functions: [
          schema,
          ...this.tools.map((tool) => convertToOpenAIFunction(tool)),
        ],
        function_call: { name: functionName },
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
        let result = await this.llm.invoke(
          [
            { role: "system", content: ASSISTANT_SYSTEM_MESSAGE },
            { role: "user", content: message },
          ],
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

        return result.content;
      } else {
        // Non-streaming mode
        const result = await this.chain.invoke({ input: message });
        return JSON.stringify(result);
      }
    } catch (error) {
      console.error("Error processing message:", error);

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
      // When processing an image, use the google_lens tool directly
      const googleLensTool = this.tools.find(
        (tool) => tool.name === "google_lens"
      );

      if (googleLensTool && imageData) {
        try {
          const lensResults = await googleLensTool.invoke(imageData);

          const enhancedMessage = `${message}\n\nImage analysis results: ${lensResults}`;

          return this.processMessage(enhancedMessage, callback);
        } catch (error) {
          console.error("Error using google_lens tool:", error);
        }
      }

      const messageWithImage = `${message}\n\nImage: ${imageData}`;
      return this.processMessage(messageWithImage, callback);
    } catch (error) {
      console.error("Error processing message with image:", error);
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
