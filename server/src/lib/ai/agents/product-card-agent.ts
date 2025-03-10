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

import { createGraphTools } from "../tools/graph-tools.js";
import { createSearchTools } from "../tools/search-tools.js";
import { productCardSchema } from "../schemas/product-card-schema.js";
import { LangTools, ToolDependencies } from "../tools/types.js";
import { ProductCardOutput } from "./types.js";
import serpGoogleLens from "../../../services/serp-google-lens/index.js";

export class ProductCardAgent {
  private llm: ChatOpenAI;
  private chain: RunnableSequence;
  private tools: LangTools;
  private embeddingsModel: OpenAIEmbeddings;
  private graphTools: LangTools;

  constructor() {
    this.llm = new ChatOpenAI({
      ...LLM_CONFIG,
      temperature: 0,
    });

    this.embeddingsModel = new OpenAIEmbeddings(EMBEDDINGS_CONFIG);

    const toolDeps: ToolDependencies = {
      embeddingsModel: this.embeddingsModel,
    };

    this.graphTools = createGraphTools(toolDeps);
    
    this.tools = [
      ...this.graphTools,
      ...createSearchTools(toolDeps),
    ];

    const functionName = "generate_product_card";
    const schema = {
      name: functionName,
      description:
        "Generate a structured product card with all relevant information",
      parameters: productCardSchema,
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
   * Try to extract a product name from user input
   */
  private extractProductName(input: string): string | null {
    // Simple regex-based extraction without LLM
    const regex = /(?:about|information on|info on|details on|what is|tell me about|product card for)\s+([^?.!,;:]+)/i;
    const match = input.match(regex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Check if input might be a direct product name (less than 5 words)
    const wordCount = input.split(/\s+/).length;
    if (wordCount < 5) {
      return input.trim();
    }
    
    return null;
  }

  /**
   * Try to find a product by name using the graph tools
   */
  private async findProductByName(productName: string): Promise<any> {
    try {
      const findProductTool = this.graphTools.find(
        tool => tool.name === "find_product_by_name"
      );
      
      if (!findProductTool) {
        console.warn("find_product_by_name tool not found");
        return null;
      }
      
      const result = await findProductTool.invoke(productName);
      
      try {
        return JSON.parse(result);
      } catch (e) {
        console.error("Error parsing product search result", e);
        return null;
      }
    } catch (error) {
      console.error("Error finding product by name:", error);
      return null;
    }
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
      const productName = this.extractProductName(message);
      
      let productInfo = null;
      if (productName) {
        productInfo = await this.findProductByName(productName);
      }
      
      let enhancedMessage = message;
      if (productInfo && !productInfo.error) {
        enhancedMessage = `${message}\n\nProduct information: ${JSON.stringify(productInfo)}`;
      }

      if (callback) {
        // Streaming mode
        const result = await this.llm.invoke(
          [
            { role: "system", content: ASSISTANT_SYSTEM_MESSAGE },
            { role: "user", content: enhancedMessage },
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
        // Non-streaming mode with automatic product lookup
        const result = await this.chain.invoke({ input: enhancedMessage });
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
      let productInfo = null;
      let enhancedMessage = message;
      
      // if (message) {
      //   const productName = this.extractProductName(message);
      //   if (productName) {
      //     productInfo = await this.findProductByName(productName);
      //   }
      // }

      if (imageData) {
        try {
          const googleLensInput = {
            base64: imageData,
          };
          // console.debug("Google Lens input in agent:", googleLensInput);
          const lensResults = await serpGoogleLens(googleLensInput);
          // console.debug("Google Lens results:", lensResults);

          // if (lensResults && lensResults.visualMatches && lensResults.visualMatches.length > 0 && !productInfo) {
          //   const topMatch = lensResults.visualMatches[0];
          //   if (topMatch.title) {
          //     productInfo = await this.findProductByName(topMatch.title);
          //   }
          // }

          enhancedMessage = `${enhancedMessage}\n\nGoogle Lens results: ${JSON.stringify(lensResults)}`;
        } catch (error) {
          console.error("Error using google_lens tool:", error);
        }
      }
      
      // if (productInfo && !productInfo.error) {
      //   enhancedMessage = `${enhancedMessage}\n\nProduct information: ${JSON.stringify(productInfo)}`;
      // }

      return this.processMessage(enhancedMessage, callback);
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