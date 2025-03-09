import {
    executeAqlQuery,
    sanitizeKey,
    db,
  } from "../../../../services/db/index.js";
  
  /**
   * Get the database schema
   */
  export async function getDbSchema(): Promise<string> {
    const collections = await db.collections();
    
    const schemaInfo = [];
    for (const collection of collections) {
      const props = await collection.properties();
      const sample = await executeAqlQuery(`
        FOR doc IN ${collection.name} 
        LIMIT 1 
        RETURN doc
      `);
      
      schemaInfo.push({
        collection: collection.name,
        type: props.type === 2 ? 'document' : 'edge',
        properties: sample.length > 0 ? Object.keys(sample[0]).map(key => ({
          name: sanitizeKey(key),
          type: typeof sample[0][key]
        })) : []
      });
    }
    
    return JSON.stringify(schemaInfo, null, 2);
  }
  
  /**
   * Find products by name or partial name match and retrieve helpful reviews
   */
  export async function findProductByName(productName: string): Promise<string> {
    if (!productName) {
      return JSON.stringify({ error: "Product name is required" });
    }
    
    try {
      // Search for products with similar names
      const products = await executeAqlQuery(`
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
            rating: review.rating,
            title: review.title,
            text: review.text,
            helpful_votes: review.helpful_votes,
            verified_purchase: review.verified_purchase_count: product.rating_count,
            features: product.features_text,
            images: product.images,
            store: product.store
          }
      `, { productName });
      
      if (products.length === 0) {
        return JSON.stringify({ 
          message: "No products found matching the name", 
          products: [] 
        });
      }
      
      // Get the best match product
      const bestMatch = products[0];
      
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
      `, { asin: bestMatch.asin });
      
      return JSON.stringify({
        product: bestMatch,
        reviews: reviews,
        alternatives: products.slice(1) // Other matches as alternatives
      }, null, 2);
    } catch (error) {
      console.error("Error finding product by name:", error);
      return JSON.stringify({ error: "Failed to find product information" });
    }
  }
  
  /**
   * Interface for product queries with filtering
   */
  interface ProductQueryParams {
    category?: string;
    limit?: number;
    min_reviews?: number;
    product_id?: string;
    asin?: string;
  }
  
  /**
   * Get the most popular products (by review count) in a category or overall
   */
  export async function getPopularProducts(args: string): Promise<string> {
    try {
      const params = JSON.parse(args) as ProductQueryParams;
      const { category, limit = 10 } = params;
      
      let query = "";
      let queryParams: Record<string, any> = { limit: parseInt(String(limit)) };
      
      if (category && category.trim() !== "") {
        // Get popular products in a specific category
        queryParams.category = category;
        query = `
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
        `;
      } else {
        // Get overall most popular products
        query = `
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
      }
      
      const products = await executeAqlQuery(query, queryParams);
      
      return JSON.stringify({
        category: category || "All categories",
        count: products.length,
        products: products
      }, null, 2);
    } catch (error) {
      console.error("Error getting popular products:", error);
      return JSON.stringify({ 
        error: "Failed to retrieve popular products",
        hint: "Make sure to provide a valid JSON with optional 'category' and 'limit' fields"
      });
    }
  }
  
  /**
   * Get the highest rated products in a category or overall
   */
  export async function getBestRatedProducts(args: string): Promise<string> {
    try {
      const params = JSON.parse(args) as ProductQueryParams;
      const { 
        category, 
        limit = 10, 
        min_reviews = 5 
      } = params;
      
      let query = "";
      let queryParams: Record<string, any> = { 
        limit: parseInt(String(limit)), 
        min_reviews: parseInt(String(min_reviews)) 
      };
      
      if (category && category.trim() !== "") {
        // Get best-rated products in a specific category
        queryParams.category = category;
        query = `
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
        `;
      } else {
        // Get overall best-rated products
        query = `
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
      }
      
      const products = await executeAqlQuery(query, queryParams);
      
      return JSON.stringify({
        category: category || "All categories",
        min_reviews: min_reviews,
        count: products.length,
        products: products
      }, null, 2);
    } catch (error) {
      console.error("Error getting best rated products:", error);
      return JSON.stringify({ 
        error: "Failed to retrieve best rated products",
        hint: "Make sure to provide a valid JSON with optional 'category', 'limit', and 'min_reviews' fields"
      });
    }
  }
  
  /**
   * Find products that match a given description
   */
  export async function findProductByDescription(description: string): Promise<string> {
    if (!description) {
      return JSON.stringify({ error: "Product description is required" });
    }
    
    try {
      const products = await executeAqlQuery(`
        FOR product IN Products
          LET score1 = CONTAINS(LOWER(product.title), LOWER(@description)) ? 3 : 0
          LET score2 = CONTAINS(LOWER(product.description), LOWER(@description)) ? 2 : 0
          LET score3 = CONTAINS(LOWER(product.features_text), LOWER(@description)) ? 2 : 0
          LET total_score = score1 + score2 + score3
          FILTER total_score > 0
          SORT total_score DESC, product.average_rating DESC
          LIMIT 5
          RETURN {
            product_id: product._id,
            title: product.title,
            description: product.description,
            features: product.features_text,
            price: product.price,
            average_rating: product.average_rating,
            rating_count: product.rating_count,
            match_score: total_score
          }
      `, { description });
      
      if (products.length === 0) {
        return JSON.stringify({ 
          message: "No products found matching the description", 
          products: [] 
        });
      }
      
      return JSON.stringify({
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
   * Get a summary of reviews for a specific product by ASIN or product ID
   */
//   export async function getProductReviewsSummary(args: string): Promise<string> {
//     try {
//       const params = JSON.parse(args) as ProductQueryParams;
//       const { product_id, asin, limit = 10 } = params;
      
//       if (!product_id && !asin) {
//         return JSON.stringify({ error: "Either product_id or asin must be provided" });
//       }
      
//       let queryParams: Record<string, any> = { limit: parseInt(String(limit)) };
//       let filterClause = "";
      
//       if (product_id) {
//         queryParams.product_id = product_id;
//         filterClause = "FILTER product._id == @product_id";
//       } else if (asin) {
//         queryParams.asin = asin;
//         filterClause = "FILTER product.parent_asin == @asin";
//       }
      
//       // First get the product details
//       const productQuery = `
//         FOR product IN Products
//           ${filterClause}
//           LIMIT 1
//           RETURN {
//             product_id: product._id,
//             asin: product.parent_asin,
//             title: product.title,
//             average_rating: product.average_rating,
//             rating_count: product.rating_count
//           }
//       `;
      
//       const products = await executeAqlQuery(productQuery, queryParams);
      
//       if (products.length === 0) {
//         return JSON.stringify({ error: "Product not found" });
//       }
      
//       const product = products[0];
      
//       // Get the reviews
//       queryParams.asin = product.asin;
//       const reviewsQuery = `
//         FOR review IN Reviews
//           FILTER review.parent_asin == @asin
//           SORT review.helpful_votes DESC, review.rating DESC
//           LIMIT @limit
//           RETURN {
//             rating