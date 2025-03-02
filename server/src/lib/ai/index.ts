import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { DynamicStructuredTool, DynamicTool, StructuredTool } from 'langchain/tools';
import { BaseChatMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { db, executeAqlQuery, sanitizeKey } from '../index.js';
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from '@langchain/core/prompts';
// import { OpenAI } from 'openai';
// import { z } from 'zod';

// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });

const createGraphRagTools = (embeddingsModel: OpenAIEmbeddings) => {
    return [
        new DynamicTool({
            name: "get_product_by_description",
            description: "Searches for products that match a given description by using vector similarity search on product embeddings.",
            // schema: z.object({
            //     query: z.string().describe("The description or query to search for")
            // }),
            func: async ( query ) => {
                try {
                    const queryEmbedding = await embeddingsModel.embedQuery(query);
                    
                    const aql = `
                    FOR product IN Products
                        LET score = COSINE_SIMILARITY(product.embedding, @embedding)
                        FILTER score > 0.7
                        SORT score DESC
                        LIMIT 5
                        RETURN {
                            asin: product._key,
                            title: product.title,
                            description: product.description,
                            price: product.price,
                            average_rating: product.average_rating,
                            score: score
                        }
                    `;
                    
                    const results = await executeAqlQuery(aql, { embedding: queryEmbedding });
                    
                    if (!results || results.length === 0) {
                        return "No products found matching your description.";
                    }
                    
                    let response = "Here are products that match your description:\n\n";
                    results.forEach((product, i) => {
                        response += `${i+1}. ${product.title}\n`;
                        response += `   Price: $${product.price}\n`;
                        response += `   Rating: ${product.average_rating}/5.0\n`;
                        response += `   ASIN: ${product.asin}\n\n`;
                    });
                    
                    return response;
                    
                } catch (error) {
                    console.error("Error in get_product_by_description:", error);
                    return "Sorry, I couldn't search for products at this time due to a technical issue.";
                }
            }
        }),

        new DynamicTool({
            name: "get_reviews_for_product",
            description: "Retrieves reviews for a specific product identified by its ASIN (Amazon product ID).",
            // schema: z.object({
            //     asin: z.string().describe("The ASIN (Amazon product ID) to retrieve reviews for")
            // }),
            func: async ( asin ) => {
                try {
                    const sanitizedAsin = sanitizeKey(asin);
                    
                    const aql = `
                    FOR review IN Reviews
                        FILTER review.asin == @asin
                        SORT review.helpful_votes DESC
                        LIMIT 5
                        RETURN {
                            title: review.title,
                            text: review.text,
                            rating: review.rating,
                            helpful_votes: review.helpful_votes,
                            verified_purchase: review.verified_purchase
                        }
                    `;
                    
                    const reviews = await executeAqlQuery(aql, { asin: sanitizedAsin });
                    
                    if (!reviews || reviews.length === 0) {
                        return `No reviews found for product with ASIN ${asin}.`;
                    }
                    
                    const productQuery = `
                    FOR product IN Products
                        FILTER product._key == @asin
                        RETURN product.title
                    `;
                    
                    const productTitles = await executeAqlQuery(productQuery, { asin: sanitizedAsin });
                    const productTitle = productTitles.length > 0 ? productTitles[0] : "Unknown Product";
                    
                    let response = `Reviews for ${productTitle} (ASIN: ${asin}):\n\n`;
                    reviews.forEach((review, i) => {
                        response += `${i+1}. ${review.title} - ${review.rating}/5.0 stars\n`;
                        response += `   ${review.text}\n`;
                        if (review.verified_purchase) {
                            response += `   (Verified Purchase)\n`;
                        }
                        response += `   Helpful votes: ${review.helpful_votes}\n\n`;
                    });
                    
                    return response;
                    
                } catch (error) {
                    console.error("Error in get_reviews_for_product:", error);
                    return "Sorry, I couldn't retrieve reviews at this time due to a technical issue.";
                }
            }
        }),

        new DynamicTool({
            name: "analyze_product_network",
            description: "Uses graph analytics to analyze the product network. Can identify related products, popular items, and customer patterns.",
            // schema: z.object({
            //     query: z.string().describe("The type of analysis to perform, such as finding popular products or similar products to a specific ASIN.")
            // }),
            func: async ( query ) => {
                try {
                    //TODO: expand this to use vector similiarity search for related products
                    if (query.toLowerCase().includes("popular") || query.toLowerCase().includes("best selling")) {
                        const aql = `
                        FOR product IN Products
                            SORT product.rating_count DESC
                            LIMIT 5
                            RETURN {
                                asin: product._key,
                                title: product.title,
                                reviews: product.rating_count,
                                rating: product.average_rating
                            }
                        `;
                        
                        const products = await executeAqlQuery(aql);
                        
                        let response = "Most popular products based on number of reviews:\n\n";
                        products.forEach((product, i) => {
                            response += `${i+1}. ${product.title}\n`;
                            response += `   Total reviews: ${product.reviews}\n`;
                            response += `   Average rating: ${product.rating}/5.0\n\n`;
                        });
                        
                        return response;
                        
                    } else if (query.toLowerCase().includes("similar") || query.toLowerCase().includes("related")) {
                        // Extract ASIN from query if present
                        const asinMatch = query.match(/[A-Z0-9]{10}/);
                        const asin = asinMatch ? asinMatch[0] : null;
                        
                        if (asin) {
                            const aql = `
                            LET variants = (
                                FOR v, e IN 1..1 ANY @asin VariantOf
                                    RETURN v
                            )
                            
                            LET product = DOCUMENT(CONCAT('Products/', @asin))
                            
                            LET similar_products = (
                                FOR other IN Products
                                    FILTER other._key != @asin
                                    FILTER other.main_category == product.main_category
                                    SORT ABS(other.price - product.price) ASC
                                    LIMIT 3
                                    RETURN other
                            )
                            
                            RETURN {
                                variants: variants,
                                similar: similar_products,
                                original: product
                            }
                            `;
                            
                            const results = await executeAqlQuery(aql, { asin: sanitizeKey(asin) });
                            const result = results[0];
                            
                            if (!result || !result.original) {
                                return `Could not find product with ASIN ${asin}.`;
                            }
                            
                            let response = `Analysis for product: ${result.original.title || 'Unknown'}\n\n`;
                            
                            if (result.variants && result.variants.length > 0) {
                                response += "Product variants:\n";
                                result.variants.forEach((variant: any, i: any) => {
                                    response += `${i+1}. ${variant.title || 'Unknown'}\n`;
                                    response += `   Price: $${variant.price || 0}\n`;
                                    response += `   ASIN: ${variant._key || 'Unknown'}\n\n`;
                                });
                            }
                            
                            if (result.similar && result.similar.length > 0) {
                                response += "Similar products by price and category:\n";
                                result.similar.forEach((similar: any, i: any) => {
                                    response += `${i+1}. ${similar.title || 'Unknown'}\n`;
                                    response += `   Price: $${similar.price || 0}\n`;
                                    response += `   ASIN: ${similar._key || 'Unknown'}\n\n`;
                                });
                            }
                            
                            return response;
                        } else {
                            return "To find similar products, please provide a valid ASIN (10-character Amazon product ID).";
                        }
                    } else {
                        // Default to general graph statistics
                        const productCount = await db.collection("Products").count();
                        const reviewCount = await db.collection("Reviews").count();
                        const userCount = await db.collection("Users").count();
                        
                        return `
                        Graph Analytics Summary:
                        
                        - Total Products: ${productCount}
                        - Total Reviews: ${reviewCount}
                        - Total Users: ${userCount}
                        
                        To get more specific analytics, try asking about:
                        - Popular or best-selling products
                        - Similar or related products (with an ASIN)
                        - Category trends
                        `;
                    }
                    
                } catch (error) {
                    console.error("Error in analyze_product_network:", error);
                    return "Sorry, I couldn't analyze the product network at this time due to a technical issue.";
                }
            }
        }),

        // new DynamicStructuredTool({
        //     // WILL BE REPLACED WITH GOOGLE LENS INTEGRATION
        //     name: "analyze_image",
        //     description: "Analyzes an image from a URL or base64 string to identify products or extract relevant information.",
        //     schema: z.object({
        //         imageData: z.string().describe("Either a URL to an image or a base64-encoded image string"),
        //         isUrl: z.boolean().describe("Whether the imageData is a URL (true) or base64 string (false)")
        //     }),
        //     func: async ({ imageData, isUrl }) => {
        //         try {
        //             let content, formattedBase64;
        //             if (isUrl) {
        //                 content = [
        //                     { type: "text", text: "What products can you see in this image? Please describe them in detail." },
        //                     { type: "image_url", image_url: { url: imageData } }
        //                 ];
        //             } else {
        //                 formattedBase64 = imageData.startsWith('data:') 
        //                     ? imageData 
        //                     : `data:image/jpeg;base64,${imageData}`;
                            
        //                 content = [
        //                     { type: "text", text: "What products can you see in this image? Please describe them in detail." },
        //                     { type: "image_url", image_url: { url: formattedBase64 } }
        //                 ];
        //             }
                    
        //             const response = await openai.chat.completions.create({
        //                 model: "gpt-4o",
        //                 stream: false,
        //                 messages: [
        //                     { 
        //                         role: "user", 
        //                         content: [
        //                             { type: "text", text: "What products can you see in this image? Please describe them in detail." },
        //                             { 
        //                                 type: "image_url", 
        //                                 image_url: isUrl 
        //                                     ? { url: imageData }
        //                                     : { url: formattedBase64 }
        //                             }
        //                         ]
        //                     }
        //                 ],
        //                 max_tokens: 500
        //             });
                    
        //             const analysis = response.choices[0].message.content;
        //             return analysis || "I couldn't analyze the image properly.";
                    
        //         } catch (error) {
        //             console.error("Error analyzing image:", error);
        //             return "Sorry, I couldn't analyze the image at this time due to a technical issue.";
        //         }
        //     }
        // }),

        new DynamicTool({
            name: "search_internet",
            description: "Simulates internet search capability to find information that might not be in the database.",
            // schema: z.object({
            //     query: z.string().describe("The search query to look up on the internet")
            // }),
            func: async ( query ) => {
                // This is a placeholder for an actual internet search capability
                // In a real implementation, you would integrate with a search API
                return `(Note: In a real implementation, this would search the internet for "${query}". For now, please let the user know that internet search is a simulated capability and recommend focusing on the product database queries instead.)`;
            }
        })
    ];
};

class ConversationMemory implements BaseChatMemory {
    chatHistory: ChatMessageHistory;
    returnMessages: boolean;
    inputKey?: string;
    outputKey?: string;
    
    constructor() {
        this.chatHistory = new ChatMessageHistory();
        this.returnMessages = true;
    }
    get memoryKeys(): string[] {
        throw new Error('Method not implemented.');
    }
    
    async loadMemoryVariables(_values: Record<string, any>) {
        const messages = await this.chatHistory.getMessages();
        if (this.returnMessages) {
            return { messages };
        }
        return { history: messages.map((message) => message.content).join("\n") };
    }
    
    async saveContext(
        inputValues: Record<string, any>,
        outputValues: Record<string, any>
    ): Promise<void> {
        // Extract the input and output values based on the input/output keys
        const input = this.inputKey ? inputValues[this.inputKey] : inputValues.input;
        const output = this.outputKey
            ? outputValues[this.outputKey]
            : outputValues.output || outputValues.response;
        
        await this.chatHistory.addUserMessage(input);
        await this.chatHistory.addAIMessage(output);
    }
    
    async clear(): Promise<void> {
        await this.chatHistory.clear();
    }
}

export class GraphRagAgent {
    private llm: ChatOpenAI;
    private embeddingsModel: OpenAIEmbeddings;
    private tools: DynamicTool[] | StructuredTool[] | DynamicStructuredTool[];
    private memory: ConversationMemory;
    private executor: AgentExecutor | null = null;
    
    constructor() {
        this.llm = new ChatOpenAI({
            modelName: "gpt-4o",
            temperature: 0.2,
            streaming: true,
        });
        
        this.embeddingsModel = new OpenAIEmbeddings({
            modelName: "text-embedding-3-small",
        });
        
        this.tools = createGraphRagTools(this.embeddingsModel);
        
        this.memory = new ConversationMemory();
    }
    
    async initialize(): Promise<void> {
        if (this.executor) return;
        
        const systemMessage = `You are an expert AI assistant with access to an ArangoDB graph database of Amazon product data.
You have tools to search for products, analyze reviews, explore the product network graph, and analyze images of products.
When users ask about products, try to understand what they're looking for and use your tools to provide helpful information.
If a user shares an image, analyze what products are visible and try to find similar items in the database.
Always be helpful, informative, and focus on providing accurate product information based on the available data.`;

        const formattedSystemtMessage = SystemMessagePromptTemplate.fromTemplate(systemMessage);        

        const prompt = ChatPromptTemplate.fromMessages([
            formattedSystemtMessage,
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
            returnIntermediateSteps: false,
            maxIterations: 5,
            verbose: true,
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
     * @param isUrl Whether the imageData is a URL
     * @param callback Optional callback function for streaming responses
     */
    async processMessageWithImage(
        message: string,
        imageData: string,
        isUrl: boolean,
        callback?: (chunk: string) => void
    ): Promise<string> {
        try {
            // First analyze the image
            const imageAnalysisTool = this.tools.find(tool => tool.name === "analyze_image");
            if (!imageAnalysisTool) {
                return "Image analysis tool not found.";
            }
            
            // Call the image analysis tool directly
            // Process with the agent
            if (!this.executor) {
                await this.initialize();
            }
            const imageAnalysis = await imageAnalysisTool.invoke({ 
                imageData, 
                isUrl 
            });
            const combinedInput = `User message: ${message}\n\nImage analysis: ${imageAnalysis}`;
            
            if (callback) {
                // For streaming mode
                const result = await this.executor!.invoke(
                    { input: combinedInput },
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
                if (!this.executor) {
                    await this.initialize();
                }
                const result = await this.executor!.invoke({ input: combinedInput });
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

export const graphRagAgent = new GraphRagAgent();

void graphRagAgent.initialize();