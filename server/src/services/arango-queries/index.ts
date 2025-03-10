import { OpenAIEmbeddings } from "@langchain/openai";
import { EMBEDDINGS_CONFIG } from "../../lib/ai/agents/constants.js";
import {
  executeAqlQuery
} from "../db/index.js";
import { buildCategoryFilter, extractKeywords, findBestRatedProducts, findByKeywordProductMatch, findByKeywordReviewMatch, findByVectorProductSimilarity, findByVectorReviewSimilarity } from "./helpers.js";

// Initialize OpenAI embeddings with config
const embeddings = new OpenAIEmbeddings(EMBEDDINGS_CONFIG);

/**
 * Input types for structured tools
 */
export interface GetPopularProductsInput {
  category?: string;
  limit?: number;
}

export interface GetBestRatedProductsInput {
  category?: string;
  limit?: number;
  min_reviews?: number;
}

export interface GetProductReviewsSummaryInput {
  product_id?: string;
  asin?: string;
  limit?: number;
}

export interface FindProductsByUserRequirementsInput {
  example_review: string;
  category?: string;
  min_rating?: number;
  max_rating?: number;
  limit?: number;
}

/**
 * Find products by name or partial name match and retrieve helpful reviews
 */
export async function findProductByName(productName: string): Promise<string> {
  console.debug('Finding products by name:', productName);
  if (!productName) {
    return JSON.stringify({ error: "Product name is required" });
  }
  
  try {
    // Search for products with similar names
    let products = await executeAqlQuery(`
      FOR product IN Products
        FILTER CONTAINS(LOWER(product.title), LOWER(@productName))
        SORT product.rating_count DESC
        LIMIT 5
        RETURN {
          product_id: product._id,
          asin: product.parent_asin,
          title: product.title,
          description: product.description,
          price: product.price,
          average_rating: product.average_rating,
          rating_count: product.rating_count,
          features: product.features_text,
          images: product.images,
          store: product.store
        }
    `, { productName });
    
    if (products.length === 0) {
      const similarity = await findByVectorProductSimilarity(await embeddings.embedQuery(productName), '', { 
        example_review: productName, 
        min_rating: 0, 
        limit: 5 
      });
      
      if (similarity.success && similarity.result) {
        products = JSON.parse(similarity.result).products || [];
      }
    }
    
    // Get helpful reviews for the best match product
    const reviews = await executeAqlQuery(`
      FOR review IN Reviews
        FILTER review.parent_asin == @asin
        SORT review.helpful_votes DESC, review.rating DESC
        LIMIT 10
        RETURN {
          rating: review.rating,
          title: review.title,
          text: review.text,
          helpful_votes: review.helpful_votes,
          verified_purchase: review.verified_purchase
        }
    `, { asin: products[0].asin });
    
    return JSON.stringify({
      product: products[0],
      reviews,
      alternatives: products.slice(1)
    }, null, 2);
    
  } catch (error) {
    console.error("Error finding product by name:", error);
    return JSON.stringify({ error: "Failed to find product information" });
  }
}

/**
 * Get the most popular products (by review count) in a category or overall
 */
export async function getPopularProducts(input: GetPopularProductsInput): Promise<string> {
  console.debug('Getting popular products:', input);
  try {
    const { category, limit = 10 } = input;
    
    const query = category ? `
      FOR product IN Products
        FOR edge IN BelongsToCategory
          FILTER edge._from == product._id
          FOR cat IN Categories
            FILTER cat._id == edge._to
            FILTER CONTAINS(LOWER(cat.name), LOWER(@category))
            SORT product.rating_count DESC
            LIMIT @limit
            RETURN {
              product_id: product._id,
              title: product.title,
              average_rating: product.average_rating,
              rating_count: product.rating_count,
              price: product.price,
              category: cat.name
            }
    ` : `
      FOR product IN Products
        SORT product.rating_count DESC
        LIMIT @limit
        LET categories = (
          FOR edge IN BelongsToCategory
            FILTER edge._from == product._id
            FOR cat IN Categories
              FILTER cat._id == edge._to
              SORT cat.level
              RETURN cat.name
        )
        RETURN {
          product_id: product._id,
          title: product.title,
          average_rating: product.average_rating,
          rating_count: product.rating_count,
          price: product.price,
          category: FIRST(categories)
        }
    `;
    
    const products = await executeAqlQuery(query, { 
      category, 
      limit: parseInt(String(limit)) 
    });
    
    return JSON.stringify({
      category: category || "All categories",
      count: products.length,
      products
    }, null, 2);
  } catch (error) {
    console.error("Error getting popular products:", error);
    return JSON.stringify({ error: "Failed to retrieve popular products" });
  }
}

/**
 * Get the highest rated products in a category or overall
 */
export async function getBestRatedProducts(input: GetBestRatedProductsInput): Promise<string> {
  console.debug('Getting best rated products:', input);
  try {
    const { 
      category, 
      limit = 10, 
      min_reviews = 5 
    } = input;
    
    const query = category ? `
      FOR product IN Products
        FILTER product.rating_count >= @min_reviews
        FOR edge IN BelongsToCategory
          FILTER edge._from == product._id
          FOR cat IN Categories
            FILTER cat._id == edge._to
            FILTER CONTAINS(LOWER(cat.name), LOWER(@category))
            SORT product.average_rating DESC, product.rating_count DESC
            LIMIT @limit
            RETURN {
              product_id: product._id,
              title: product.title,
              average_rating: product.average_rating,
              rating_count: product.rating_count,
              price: product.price,
              category: cat.name
            }
    ` : `
      FOR product IN Products
        FILTER product.rating_count >= @min_reviews
        SORT product.average_rating DESC, product.rating_count DESC
        LIMIT @limit
        LET categories = (
          FOR edge IN BelongsToCategory
            FILTER edge._from == product._id
            FOR cat IN Categories
              FILTER cat._id == edge._to
              SORT cat.level
              RETURN cat.name
        )
        RETURN {
          product_id: product._id,
          title: product.title,
          average_rating: product.average_rating,
          rating_count: product.rating_count,
          price: product.price,
          category: FIRST(categories)
        }
    `;
    
    const products = await executeAqlQuery(query, { 
      category, 
      limit: parseInt(String(limit)),
      min_reviews: parseInt(String(min_reviews))
    });
    
    return JSON.stringify({
      category: category || "All categories",
      min_reviews,
      count: products.length,
      products
    }, null, 2);
  } catch (error) {
    console.error("Error getting best rated products:", error);
    return JSON.stringify({ error: "Failed to retrieve best rated products" });
  }
}

/**
 * Find products that match a given description using vector search
 */
export async function findProductByDescription(description: string): Promise<string> {
  console.debug('Finding products by description:', description);
  if (!description) {
    return JSON.stringify({ error: "Product description is required" });
  }
  
  try {
    // Get embeddings for the description
    const embedding = await embeddings.embedQuery(description);
    
    // Use vector search in ArangoDB
    const products = await executeAqlQuery(`
      FOR product IN Products
        SEARCH ANALYZER(VECTOR_DISTANCE(product.embedding, @embedding) < 0.3, "vector")
        SORT VECTOR_DISTANCE(product.embedding, @embedding) ASC
        LIMIT 5
        RETURN {
          product_id: product._id,
          title: product.title,
          description: product.description,
          features: product.features_text,
          price: product.price,
          average_rating: product.average_rating,
          rating_count: product.rating_count,
          vector_score: VECTOR_DISTANCE(product.embedding, @embedding)
        }
    `, { embedding });
    
    if (products.length === 0) {
      return JSON.stringify({ 
        message: "No products found matching the description", 
        products: [] 
      });
    }
    
    return JSON.stringify({
      search_method: "vector",
      matches_found: products.length,
      best_match: products[0],
      other_matches: products.slice(1)
    }, null, 2);
  } catch (error) {
    console.error("Error finding product by description:", error);
    return JSON.stringify({ error: "Failed to find products matching description" });
  }
}

/**
 * Get a summary of reviews for a specific product
 */
export async function getProductReviewsSummary(input: GetProductReviewsSummaryInput): Promise<string> {
  console.debug('Getting product reviews summary:', input);
  try {
    const { product_id, asin, limit = 10 } = input;
    
    if (!product_id && !asin) {
      return JSON.stringify({ error: "Either product_id or asin must be provided" });
    }
    
    const filterClause = product_id ? 
      "FILTER product._key == @product_id" : 
      "FILTER product.parent_asin == @asin";
    
    // Get product details
    const products = await executeAqlQuery(`
      FOR product IN Products
        ${filterClause}
        LIMIT 1
        RETURN {
          asin: product.parent_asin,
          title: product.title,
          average_rating: product.average_rating,
          rating_count: product.rating_count
        }
    `, { product_id, asin });
    
    if (products.length === 0) {
      return JSON.stringify({ error: "Product not found" });
    }
    
    const product = products[0];
    
    // Get reviews and distribution
    const [reviews, ratings] = await Promise.all([
      executeAqlQuery(`
        FOR review IN Reviews
          FILTER review.parent_asin == @asin
          SORT review.helpful_votes DESC, review.rating DESC
          LIMIT @limit
          RETURN {
            rating: review.rating,
            title: review.title,
            text: review.text,
            helpful_votes: review.helpful_votes,
            verified_purchase: review.verified_purchase
          }
      `, { asin: product.asin, limit: parseInt(String(limit)) }),
      
      executeAqlQuery(`
        FOR review IN Reviews
          FILTER review.parent_asin == @asin
          COLLECT rating = review.rating WITH COUNT INTO count
          SORT rating DESC
          RETURN {
            rating: rating,
            count: count
          }
      `, { asin: product.asin })
    ]);
    
    return JSON.stringify({
      product,
      rating_distribution: ratings,
      top_reviews: reviews
    }, null, 2);
  } catch (error) {
    console.error("Error getting product reviews summary:", error);
    return JSON.stringify({ error: "Failed to retrieve product reviews summary" });
  }
}


/**
 * Main function to find products matching user requirements
 * Uses a cascade of search methods, falling back to simpler methods if needed
 */
export async function findProductsByUserRequirements(input: FindProductsByUserRequirementsInput): Promise<string> {
  console.debug('Finding products by user requirements:', input);
  try {
      const { 
          example_review, 
          category,
          min_rating = 4,
          // max_rating = 5,
          limit = 5 
      } = input;

      if (!example_review) {
          return JSON.stringify({ error: "Example review or user requirements are required" });
      }

      const params = {
          example_review,
          category,
          min_rating: parseInt(String(min_rating)),
          limit: parseInt(String(limit))
      };

      const categoryFilter = buildCategoryFilter(category);

      try {
          console.debug('Getting embeddings for:', example_review);
          const embedding = await embeddings.embedQuery(example_review);

          const reviewSearchResult = await findByVectorReviewSimilarity(
              embedding,
              categoryFilter.filter,
              params
          );

          if (reviewSearchResult.success) {
              return reviewSearchResult.result!;
          }

          const productSearchResult = await findByVectorProductSimilarity(
              embedding,
              categoryFilter.filter,
              params
          );

          if (productSearchResult.success) {
              return productSearchResult.result!;
          }
      } catch (vectorError) {
          console.warn("Vector search failed, falling back to keyword search:", vectorError);
      }

      const keywords = extractKeywords(example_review);

      // Try keyword search on reviews
      const keywordReviewResult = await findByKeywordReviewMatch(
          keywords,
          categoryFilter.filter,
          params
      );

      if (keywordReviewResult.success) {
          return keywordReviewResult.result!;
      }

      // Try keyword search on product descriptions
      const keywordProductResult = await findByKeywordProductMatch(
          keywords,
          categoryFilter.filter,
          params
      );

      if (keywordProductResult.success) {
          return keywordProductResult.result!;
      }

      // Fallback to best rated products
      const fallbackResult = await findBestRatedProducts(
          categoryFilter,
          params
      );

      if (fallbackResult.success) {
          return fallbackResult.result!;
      }

      // No products found
      return JSON.stringify({
          user_requirements: example_review,
          message: "No products found matching your requirements",
          products: []
      }, null, 2);

  } catch (error) {
      console.error("Error finding products by user requirements:", error);
      return JSON.stringify({ 
          error: "Failed to find products matching user requirements",
          hint: "Make sure to provide a detailed example_review describing what you're looking for"
      });
  }
}


// /**
//  * Find products based on user requirements in natural language
//  */
// export async function findProductsByUserRequirements(input: FindProductsByUserRequirementsInput): Promise<string> {
//   console.debug('Finding products by user requirements:', input);
//   try {
//     const { 
//       example_review, 
//       category, 
//       min_rating = 4, 
//       max_rating = 5, 
//       limit = 5 
//     } = input;

//     // Get embeddings for the example review
//     const embedding = await embeddings.embedQuery(example_review);
    
//     // Build the query based on parameters
//     let query = `
//       FOR product IN Products
//         FILTER product.average_rating >= @min_rating 
//         AND product.average_rating <= @max_rating
//     `;
    
//     if (category) {
//       query += `
//         FOR edge IN BelongsToCategory
//           FILTER edge._from == product._id
//           FOR cat IN Categories
//             FILTER cat._id == edge._to
//             FILTER CONTAINS(LOWER(cat.name), LOWER(@category))
//       `;
//     }
    
//     query += `
//         SEARCH ANALYZER(VECTOR_DISTANCE(product.embedding, @embedding) < 0.3, "vector")
//         SORT VECTOR_DISTANCE(product.embedding, @embedding) ASC
//         LIMIT @limit
//         RETURN {
//           product_id: product._id,
//           title: product.title,
//           description: product.description,
//           price: product.price,
//           average_rating: product.average_rating,
//           rating_count: product.rating_count,
//           features: product.features_text,
//           vector_score: VECTOR_DISTANCE(product.embedding, @embedding),
//           category: ${category ? 'cat.name' : 'null'}
//         }
//     `;
    
//     const products = await executeAqlQuery(query, {
//       embedding,
//       category,
//       min_rating: parseFloat(String(min_rating)),
//       max_rating: parseFloat(String(max_rating)),
//       limit: parseInt(String(limit))
//     });
    
//     return JSON.stringify({
//       search_method: "vector",
//       user_requirements: example_review,
//       matches_found: products.length,
//       products
//     }, null, 2);
//   } catch (error) {
//     console.error("Error finding products by user requirements:", error);
//     return JSON.stringify({ 
//       error: "Failed to find products matching user requirements",
//       hint: "Make sure to provide a detailed example_review describing what you're looking for"
//     });
//   }
// }
