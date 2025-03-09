import { DynamicTool } from "langchain/tools";
import { LangTools, ToolDependencies } from "./types.js";
import { 
  // getDbSchema, 
  findProductByName, 
  getPopularProducts, 
  getBestRatedProducts,
  findProductByDescription,
  // getProductReviewsSummary
} from "./implementations/graph-tools";

export function createGraphTools(
  _dependencies: ToolDependencies
): LangTools {
  return [
    // new DynamicTool({
    //   name: "get_db_schema",
    //   description: "Gets the schema of the database.",
    //   func: getDbSchema,
    // }),
    
    new DynamicTool({
      name: "find_product_by_name",
      description: "Finds products by name or partial name match and retrieves helpful reviews. Use this to get detailed information about a specific product including its reviews.",
      func: findProductByName,
    }),
    
    new DynamicTool({
      name: "get_popular_products",
      description: "Gets the most popular products (by review count) in a category. If category is empty, returns the most popular products overall.",
      func: getPopularProducts,
    }),
    
    new DynamicTool({
      name: "get_best_rated_products",
      description: "Gets the highest rated products in a category or overall. Optionally filter by minimum review count.",
      func: getBestRatedProducts,
    }),
    
    new DynamicTool({
      name: "find_product_by_description",
      description: "Finds products that match a given description. Use this to find products based on features or other attributes.",
      func: findProductByDescription,
    }),

    // new DynamicTool({
    //   name: "get_product_reviews_summary",
    //   description: "Gets a summary of reviews for a specific product by ASIN or product ID.",
    //   func: getProductReviewsSummary,
    // })
  ];
}