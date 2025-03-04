import { DynamicTool } from "langchain/tools";
import {
  executeAqlQuery,
  sanitizeKey,
  db,
} from "../../../services/db/index.js";
import { GraphRagTools, ToolDependencies } from "./types.js";

export function createNetworkTools(
  _dependencies: ToolDependencies
): GraphRagTools {
  return [
    new DynamicTool({
      name: "analyze_product_network",
      description:
        "Uses graph analytics to analyze the product network. Can identify related products, popular items, and customer patterns.",
      func: async (query) => {
        try {
          if (
            query.toLowerCase().includes("popular") ||
            query.toLowerCase().includes("best selling")
          ) {
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

            let response =
              "Most popular products based on number of reviews:\n\n";
            products.forEach((product, i) => {
              response += `${i + 1}. ${product.title}\n`;
              response += `   Total reviews: ${product.reviews}\n`;
              response += `   Average rating: ${product.rating}/5.0\n\n`;
            });

            return response;
          } else if (
            query.toLowerCase().includes("similar") ||
            query.toLowerCase().includes("related")
          ) {
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

              const results = await executeAqlQuery(aql, {
                asin: sanitizeKey(asin),
              });
              const result = results[0];

              if (!result || !result.original) {
                return `Could not find product with ASIN ${asin}.`;
              }

              let response = `Analysis for product: ${
                result.original.title || "Unknown"
              }\n\n`;

              if (result.variants && result.variants.length > 0) {
                response += "Product variants:\n";
                result.variants.forEach((variant: any, i: number) => {
                  response += `${i + 1}. ${variant.title || "Unknown"}\n`;
                  response += `   Price: $${variant.price || 0}\n`;
                  response += `   ASIN: ${variant._key || "Unknown"}\n\n`;
                });
              }

              if (result.similar && result.similar.length > 0) {
                response += "Similar products by price and category:\n";
                result.similar.forEach((similar: any, i: number) => {
                  response += `${i + 1}. ${similar.title || "Unknown"}\n`;
                  response += `   Price: $${similar.price || 0}\n`;
                  response += `   ASIN: ${similar._key || "Unknown"}\n\n`;
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
      },
    }),
  ];
}
