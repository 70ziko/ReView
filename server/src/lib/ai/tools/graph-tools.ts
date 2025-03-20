import { DynamicStructuredTool, DynamicTool } from "langchain/tools";
import { z } from "zod";
import { LangTools, ToolDependencies } from "./types.js";
import { 
  findProductByName, 
  getPopularProducts, 
  getBestRatedProducts,
  findProductByDescription,
  getProductReviewsDetails,
  findProductsByUserRequirements,
  GetPopularProductsInput,
  GetBestRatedProductsInput,
  GetProductReviewsDetailsInput,
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
      name: "get_product_reviews_details",
      description: "Gets the most helpful reviews for the product and a rating distirbution. Use this to get insights into a product's reviews and ratings.",
      schema: z.object({
        product_id: z.string().describe("Product ID to get reviews for"),
        limit: z.number().optional().default(5).describe("Maximum number of reviews to return") 
      }),
      func: async (input: GetProductReviewsDetailsInput) => 
        getProductReviewsDetails(input),
    }),

    new DynamicStructuredTool({
      name: "find_products_by_user_requirements_using_example_review",
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