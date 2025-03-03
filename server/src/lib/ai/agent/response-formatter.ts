import { z } from "zod";

export const AlternativeProduct = z.object({
  name: z.string()
    .describe("The name of the alternative product"),
  product_id: z.string()
    
    .describe("The ID of the alternative product"),
  score: z.number()
    .describe("The rating of the alternative product"),
});

export const PriceRange = z.object({
  min: z.number()
    .describe("The minimum price of the product"),
  avg: z.number()
    .describe("The average price of the product"),
});

export const ResponseFormatter = z.object({
  product_name: z.string()
    .describe("The product name"),
  score: z.number()
    .describe("The average rating of the product"),
  image_url: z.string().url()
    .describe("URL to the product image"),
  general_review: z.string()
    .describe("General review of the product"),
  amazon_reviews_ref: z
    .array(z.string().url())
    .describe("URL to Amazon reviews for the product"),
  alternatives: z.array(AlternativeProduct)
    .describe("Alternative product recommendations"),
  prices: PriceRange
    .describe("Price information for the product"),
  product_id: z.string()
    .describe("The unique identifier for the product"),
  category: z.string()
    .describe("The product category path"),
});
