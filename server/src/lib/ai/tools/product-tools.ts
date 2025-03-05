import { DynamicTool } from "langchain/tools";
import { executeAqlQuery, sanitizeKey } from "../../../services/db/index.js";
import { LangTools, ToolDependencies } from "./types.js";

export function createProductTools({
  embeddingsModel,
}: ToolDependencies): LangTools {
  return [
    new DynamicTool({
      name: "get_product_by_description",
      description:
        "Searches for products that match a given description by using vector similarity search on product embeddings.",
      func: async (query) => {
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

          const results = await executeAqlQuery(aql, {
            embedding: queryEmbedding,
          });

          if (!results || results.length === 0) {
            return "No products found matching your description.";
          }

          let response = "Here are products that match your description:\n\n";
          results.forEach((product, i) => {
            response += `${i + 1}. ${product.title}\n`;
            response += `   Price: $${product.price}\n`;
            response += `   Rating: ${product.average_rating}/5.0\n`;
            response += `   ASIN: ${product.asin}\n\n`;
          });

          return response;
        } catch (error) {
          console.error("Error in get_product_by_description:", error);
          return "Sorry, I couldn't search for products at this time due to a technical issue.";
        }
      },
    }),

    new DynamicTool({
      name: "get_reviews_for_product",
      description:
        "Retrieves reviews for a specific product identified by its ASIN (Amazon product ID).",
      func: async (asin) => {
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

          const productTitles = await executeAqlQuery(productQuery, {
            asin: sanitizedAsin,
          });
          const productTitle =
            productTitles.length > 0 ? productTitles[0] : "Unknown Product";

          let response = `Reviews for ${productTitle} (ASIN: ${asin}):\n\n`;
          reviews.forEach((review, i) => {
            response += `${i + 1}. ${review.title} - ${
              review.rating
            }/5.0 stars\n`;
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
      },
    }),
  ];
}
