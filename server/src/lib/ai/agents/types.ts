export interface ProductCardOutput {
  product_name: string;
  score: number;
  image_url: string;
  general_review: string;
  amazon_reviews_ref: string[];
  alternatives: { name: string; product_id: string; score: number }[];
  prices: { min: number; avg: number };
  product_id: string;
  category: string;
}