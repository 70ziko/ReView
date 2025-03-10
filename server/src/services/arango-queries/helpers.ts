import { executeAqlQuery } from "../db";

/**
 * Input types for structured tools
 */
export interface FindProductsByUserRequirementsInput {
    example_review: string;
    category?: string;
    min_rating?: number;
    max_rating?: number;
    limit?: number;
}

/**
 * Extract keywords from user requirements text
 */
function extractKeywords(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter(word => word.length > 3);
}

/**
 * Build category filter for AQL queries 
 */
function buildCategoryFilter(category?: string): { filter: string, hasCategory: boolean } {
    if (!category || category.trim() === "") {
        return { filter: "", hasCategory: false };
    }

    return {
        filter: `
            FOR edge IN BelongsToCategory
                FILTER edge._from == product._id
                FOR cat IN Categories
                    FILTER cat._id == edge._to
                    FILTER CONTAINS(LOWER(cat.name), LOWER(@category))
        `,
        hasCategory: true
    };
}

/**
 * Try to find matching products using vector search on reviews
 */
async function findByVectorReviewSimilarity(
    embedding: number[], 
    categoryFilter: string,
    params: {
        example_review: string,
        category?: string,
        min_rating: number,
        limit: number
    }
): Promise<{ success: boolean, result?: string }> {
    console.debug('Finding by vector review similarity:', { categoryFilter, params });
    try {
        const queryParams: Record<string, any> = { 
            embedding,
            limit: params.limit,
            min_rating: params.min_rating
        };

        if (params.category) {
            queryParams.category = params.category;
        }

        // Find products with reviews similar to user requirements
        const reviewMatchQuery = `
            FOR review IN Reviews
                SEARCH ANALYZER(COSINE_SIMILARITY(review.embedding, @embedding) < 0.3, "vector")
                FILTER review.rating >= @min_rating
                SORT COSINE_SIMILARITY(review.embedding, @embedding) ASC
                LIMIT 20
                FOR product IN Products
                    FILTER product.parent_asin == review.parent_asin OR product.parent_asin == review.asin
                    ${categoryFilter}
                    COLLECT product_id = product._id, 
                            title = product.title,
                            description = product.description,
                            features = product.features_text,
                            price = product.price,
                            average_rating = product.average_rating,
                            rating_count = product.rating_count
                    WITH COUNT INTO review_count
                    SORT review_count DESC, average_rating DESC
                    LIMIT @limit
                    RETURN {
                        product_id: product_id,
                        title: title,
                        description: description,
                        features: features,
                        price: price,
                        average_rating: average_rating,
                        rating_count: rating_count,
                        matching_reviews_count: review_count,
                        search_method: "vector_review_similarity"
                    }
        `;

        const reviewMatches = await executeAqlQuery(reviewMatchQuery, queryParams);

        if (reviewMatches.length === 0) {
            return { success: false };
        }

        // For each product, get sample matching reviews
        for (let i = 0; i < reviewMatches.length; i++) {
            const product = reviewMatches[i];
            const matchingReviewsQuery = `
                FOR review IN Reviews
                    SEARCH ANALYZER(COSINE_SIMILARITY(review.embedding, @embedding) < 0.3, "vector")
                    FOR p IN Products
                        FILTER p._id == @product_id AND (p.parent_asin == review.parent_asin OR p.parent_asin == review.asin)
                        SORT COSINE_SIMILARITY(review.embedding, @embedding) ASC
                        LIMIT 3
                        RETURN {
                            rating: review.rating,
                            title: review.title,
                            text: review.text,
                            helpful_votes: review.helpful_votes
                        }
            `;

            const matchingReviews = await executeAqlQuery(matchingReviewsQuery, {
                embedding,
                product_id: product.product_id
            });

            product.sample_matching_reviews = matchingReviews;
        }

        return {
            success: true,
            result: JSON.stringify({
                search_method: "vector_review_similarity",
                user_requirements: params.example_review,
                matches_found: reviewMatches.length,
                products: reviewMatches
            }, null, 2)
        };
    } catch (error) {
        console.error("Error in vector review similarity search:", error);
        return { success: false };
    }
}

/**
 * Try to find matching products using vector search on product descriptions
 */
async function findByVectorProductSimilarity(
    embedding: number[], 
    categoryFilter: string,
    params: {
        example_review: string,
        category?: string,
        min_rating: number,
        limit: number
    }
): Promise<{ success: boolean, result?: string }> {
    console.debug('Finding by vector product similarity:', { categoryFilter, params });
    try {
        const queryParams: Record<string, any> = { 
            embedding,
            limit: params.limit,
            min_rating: params.min_rating
        };

        if (params.category) {
            queryParams.category = params.category;
        }

        // Try product description/features vector similarity
        const productMatchQuery = `
            FOR product IN Products
                SEARCH ANALYZER(COSINE_SIMILARITY(product.embedding, @embedding) < 0.3, "vector")
                FILTER product.average_rating >= @min_rating
                ${categoryFilter}
                SORT COSINE_SIMILARITY(product.embedding, @embedding) ASC
                LIMIT @limit
                RETURN {
                    product_id: product._id,
                    title: product.title,
                    description: product.description,
                    features: product.features_text,
                    price: product.price,
                    average_rating: product.average_rating,
                    rating_count: product.rating_count,
                    search_method: "vector_product_similarity"
                }
        `;

        const productMatches = await executeAqlQuery(productMatchQuery, queryParams);

        if (productMatches.length === 0) {
            return { success: false };
        }

        return {
            success: true,
            result: JSON.stringify({
                search_method: "vector_product_similarity",
                user_requirements: params.example_review,
                matches_found: productMatches.length,
                products: productMatches
            }, null, 2)
        };
    } catch (error) {
        console.error("Error in vector product similarity search:", error);
        return { success: false };
    }
}

/**
 * Try to find matching products using keyword search on reviews
 */
async function findByKeywordReviewMatch(
    keywords: string[], 
    categoryFilter: string,
    params: {
        example_review: string,
        category?: string,
        min_rating: number,
        limit: number
    }
): Promise<{ success: boolean, result?: string }> {
    console.debug('Finding by keyword review match:', { keywords, categoryFilter, params });
    try {
        const queryParams: Record<string, any> = { 
            requirements: params.example_review,
            limit: params.limit,
            min_rating: params.min_rating
        };

        if (params.category) {
            queryParams.category = params.category;
        }

        // Build keyword match conditions for reviews
        let keywordConditions = [];
        for (let i = 0; i < keywords.length; i++) {
            queryParams[`keyword${i}`] = keywords[i];
            keywordConditions.push(`CONTAINS(LOWER(review.text), @keyword${i})`);
        }

        const keywordConditionStr = keywordConditions.join(' OR ');

        // Search for reviews matching keywords
        const keywordReviewQuery = `
            FOR review IN Reviews
                FILTER (${keywordConditionStr}) AND review.rating >= @min_rating
                FOR product IN Products
                    FILTER product.parent_asin == review.parent_asin OR product.parent_asin == review.asin
                    ${categoryFilter}
                    COLLECT product_id = product._id, 
                            title = product.title,
                            description = product.description,
                            features = product.features_text,
                            price = product.price,
                            average_rating = product.average_rating,
                            rating_count = product.rating_count
                    WITH COUNT INTO keyword_match_count
                    SORT keyword_match_count DESC, average_rating DESC
                    LIMIT @limit
                    RETURN {
                        product_id: product_id,
                        title: title,
                        description: description,
                        features: features,
                        price: price,
                        average_rating: average_rating,
                        rating_count: rating_count,
                        keyword_match_count: keyword_match_count,
                        search_method: "keyword_review_match"
                    }
        `;

        const keywordReviewMatches = await executeAqlQuery(keywordReviewQuery, queryParams);

        if (keywordReviewMatches.length === 0) {
            return { success: false };
        }

        // For each product, get sample matching reviews
        for (let i = 0; i < keywordReviewMatches.length; i++) {
            const product = keywordReviewMatches[i];
            const matchingReviewsQuery = `
                FOR review IN Reviews
                    FILTER (${keywordConditionStr}) AND review.rating >= @min_rating
                    FOR p IN Products
                        FILTER p._id == @product_id AND p.parent_asin == review.parent_asin
                        SORT review.helpful_votes DESC
                        LIMIT 3
                        RETURN {
                            rating: review.rating,
                            title: review.title,
                            text: review.text,
                            helpful_votes: review.helpful_votes
                        }
            `;

            const matchingReviews = await executeAqlQuery(matchingReviewsQuery, {
                ...queryParams,
                product_id: product.product_id
            });

            product.sample_matching_reviews = matchingReviews;
        }

        return {
            success: true,
            result: JSON.stringify({
                search_method: "keyword_review_match",
                user_requirements: params.example_review,
                matches_found: keywordReviewMatches.length,
                products: keywordReviewMatches
            }, null, 2)
        };
    } catch (error) {
        console.error("Error in keyword review match search:", error);
        return { success: false };
    }
}

/**
 * Try to find matching products using keyword search on product descriptions
 */
async function findByKeywordProductMatch(
    keywords: string[], 
    categoryFilter: string,
    params: {
        example_review: string,
        category?: string,
        min_rating: number,
        limit: number
    }
): Promise<{ success: boolean, result?: string }> {
    console.debug('Finding by keyword product match:', { keywords, categoryFilter, params });
    try {
        const queryParams: Record<string, any> = { 
            requirements: params.example_review,
            limit: params.limit,
            min_rating: params.min_rating
        };

        if (params.category) {
            queryParams.category = params.category;
        }

        // Add keywords to query params
        for (let i = 0; i < keywords.length; i++) {
            queryParams[`keyword${i}`] = keywords[i];
        }

        // Try to find products with matching descriptions or features
        const productKeywordQuery = `
            FOR product IN Products
                FILTER product.average_rating >= @min_rating
                ${categoryFilter}
                LET description_score = (
                    ${keywords.map((_, i) => `CONTAINS(LOWER(product.description), @keyword${i}) ? 1 : 0`).join(' + ')}
                )
                LET features_score = (
                    ${keywords.map((_, i) => `CONTAINS(LOWER(product.features_text), @keyword${i}) ? 1 : 0`).join(' + ')}
                )
                LET title_score = (
                    ${keywords.map((_, i) => `CONTAINS(LOWER(product.title), @keyword${i}) ? 2 : 0`).join(' + ')}
                )
                LET total_score = description_score + features_score + title_score
                FILTER total_score > 0
                SORT total_score DESC, product.average_rating DESC
                LIMIT @limit
                RETURN {
                    product_id: product._id,
                    title: product.title,
                    description: product.description,
                    features: product.features_text,
                    price: product.price,
                    average_rating: product.average_rating,
                    rating_count: product.rating_count,
                    keyword_match_score: total_score,
                    search_method: "keyword_product_match"
                }
        `;

        const productKeywordMatches = await executeAqlQuery(productKeywordQuery, queryParams);

        if (productKeywordMatches.length === 0) {
            return { success: false };
        }

        return {
            success: true,
            result: JSON.stringify({
                search_method: "keyword_product_match",
                user_requirements: params.example_review,
                matches_found: productKeywordMatches.length,
                products: productKeywordMatches
            }, null, 2)
        };
    } catch (error) {
        console.error("Error in keyword product match search:", error);
        return { success: false };
    }
}

/**
 * Fallback to best rated products in category or overall
 */
async function findBestRatedProducts(
    categoryFilter: { filter: string, hasCategory: boolean },
    params: {
        example_review: string,
        category?: string,
        min_rating: number,
        limit: number
    }
): Promise<{ success: boolean, result?: string }> {
    console.debug('Finding best rated products (fallback):', { categoryFilter, params });
    try {
        const queryParams: Record<string, any> = { 
            limit: params.limit,
            min_rating: params.min_rating
        };

        if (params.category) {
            queryParams.category = params.category;
        }

        // Choose appropriate fallback query
        let fallbackQuery = "";
        if (categoryFilter.hasCategory) {
            fallbackQuery = `
                FOR product IN Products
                    FILTER product.average_rating >= @min_rating
                    ${categoryFilter.filter}
                    SORT product.average_rating DESC, product.rating_count DESC
                    LIMIT @limit
                    RETURN {
                        product_id: product._id,
                        title: product.title,
                        description: product.description,
                        features: product.features_text,
                        price: product.price,
                        average_rating: product.average_rating,
                        rating_count: product.rating_count,
                        search_method: "fallback_category_best"
                    }
            `;
        } else {
            fallbackQuery = `
                FOR product IN Products
                    FILTER product.average_rating >= @min_rating AND product.rating_count >= 10
                    SORT product.average_rating DESC, product.rating_count DESC
                    LIMIT @limit
                    RETURN {
                        product_id: product._id,
                        title: product.title,
                        description: product.description,
                        features: product.features_text,
                        price: product.price,
                        average_rating: product.average_rating,
                        rating_count: product.rating_count,
                        search_method: "fallback_overall_best"
                    }
            `;
        }

        const fallbackMatches = await executeAqlQuery(fallbackQuery, queryParams);

        if (fallbackMatches.length === 0) {
            return { success: false };
        }

        return {
            success: true,
            result: JSON.stringify({
                search_method: "fallback_best_rated",
                user_requirements: params.example_review,
                note: "No direct matches found, showing best rated products instead",
                matches_found: fallbackMatches.length,
                products: fallbackMatches
            }, null, 2)
        };
    } catch (error) {
        console.error("Error in fallback best rated search:", error);
        return { success: false };
    }
}

export {
  extractKeywords,
  buildCategoryFilter,
  findByVectorReviewSimilarity,
  findByVectorProductSimilarity,
  findByKeywordReviewMatch,
  findByKeywordProductMatch,
  findBestRatedProducts,
};
