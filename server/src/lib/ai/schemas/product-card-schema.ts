export const productCardSchema = {
  title: "ProductCard",
  description: "A product card containing information about a product",
  type: "object",
  properties: {
    product_name: {
      type: "string",
      description: "The product name",
    },
    score: {
      type: "number",
      description: "The average rating of the product",
    },
    image_url: {
      type: "string",
      description: "URL to the product image",
    },
    general_review: {
      type: "string",
      description: "General review of the product",
    },
    amazon_reviews_ref: {
      type: "array",
      items: {
        type: "string",
      },
      description: "URL to Amazon reviews for the product",
    },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the alternative product",
          },
          product_id: {
            type: "string",
            description: "The ID of the alternative product",
          },
          score: {
            type: "number",
            description: "The rating of the alternative product",
          },
        },
        required: ["name", "product_id", "score"],
      },
      description: "Alternative product recommendations",
    },
    prices: {
      type: "object",
      properties: {
        min: {
          type: "number",
          description: "The minimum price of the product",
        },
        avg: {
          type: "number",
          description: "The average price of the product",
        },
      },
      required: ["min", "avg"],
      description: "Price information for the product",
    },
    product_id: {
      type: "string",
      description: "The unique identifier for the product",
    },
    category: {
      type: "string",
      description: "The product category path",
    },
  },
  required: [
    "product_name",
    "score",
    "image_url",
    "general_review",
    "amazon_reviews_ref",
    "alternatives",
    "prices",
    "product_id",
    "category",
  ],
};
