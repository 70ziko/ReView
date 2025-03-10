import { DynamicStructuredTool, DynamicTool } from "langchain/tools";
import { z } from "zod";
import { LangTools, ToolDependencies } from "./types.js";
import { 
  findProductByName, 
  getPopularProducts, 
  getBestRatedProducts,
  findProductByDescription,
  getProductReviewsSummary,
  findProductsByUserRequirements,
  GetPopularProductsInput,
  GetBestRatedProductsInput,
  GetProductReviewsSummaryInput,
  FindProductsByUserRequirementsInput
} from "../../../services/arango-queries";

export function createGraphTools(
  _dependencies: ToolDependencies
): LangTools {
  return [
    new DynamicTool({
      name: "find_product_by_name",
      description: "Finds products by name or partial name match and retrieves helpful reviews. Use this to get detailed information about a specific product including its reviews.",
      func: findProductByName,
    }),
    
    new DynamicStructuredTool({
      name: "get_popular_products",
      description: "Gets the most popular products (by review count) in a category. If category is empty, returns the most popular products overall.",
      schema: z.object({
        category: z.string().optional().describe("Category name to filter products by"),
        limit: z.number().optional().default(10).describe("Maximum number of products to return")
      }),
      func: async (input: GetPopularProductsInput) => getPopularProducts(input),
    }),
    
    new DynamicStructuredTool({
      name: "get_best_rated_products",
      description: "Gets the highest rated products in a category or overall. Optionally filter by minimum review count.",
      schema: z.object({
        category: z.string().optional().describe("Category name to filter products by"),
        limit: z.number().optional().default(10).describe("Maximum number of products to return"),
        min_reviews: z.number().optional().default(5).describe("Minimum number of reviews required")
      }),
      func: async (input: GetBestRatedProductsInput) => getBestRatedProducts(input),
    }),
    
    new DynamicTool({
      name: "find_product_by_description",
      description: "Finds products that match a given description. Use this to find products based on features or other attributes.",
      func: findProductByDescription,
    }),

    new DynamicStructuredTool({
      name: "get_product_reviews_summary",
      description: "Gets a summary of reviews for a specific product by ASIN or product ID.",
      schema: z.object({
        product_id: z.string().optional().describe("Product ID to get reviews for"),
        asin: z.string().optional().describe("Product ASIN to get reviews for"),
        limit: z.number().optional().default(10).describe("Maximum number of reviews to return")
      }),
      func: async (input: GetProductReviewsSummaryInput) => getProductReviewsSummary(input),
    }),
    
    new DynamicStructuredTool({
      name: "find_products_by_user_requirements",
      description: "Finds products that match specific user requirements or preferences expressed as an example review. Use this when the user has specific needs or is looking for recommendations based on particular criteria.",
      schema: z.object({
        example_review: z.string().describe("Example review or user requirements in natural language"),
        category: z.string().optional().describe("Category to search within"),
        min_rating: z.number().optional().default(4).describe("Minimum product rating (1-5)"),
        max_rating: z.number().optional().default(5).describe("Maximum product rating (1-5)"),
        limit: z.number().optional().default(5).describe("Maximum number of products to return")
      }),
      func: async (input: FindProductsByUserRequirementsInput) => findProductsByUserRequirements(input),
    })
  ];
}