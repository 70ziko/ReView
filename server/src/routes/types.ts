import { Request } from "express";
import { Session } from "express-session";

export interface CustomSession extends Session {
    userId: string;
}

export interface RequestWithSession extends Request {
    session: CustomSession;
}

// Type for product response
export interface ProductResponse {
    product_name: string;
    score: number;
    image_url: string;
    general_review: string;
    amazon_reviews_ref: string;
    alternatives: {
        name: string;
        product_id: string;
        score: number;
    }[];
    prices: {
        min: number;
        avg: number;
    };
    product_id: string;
    category: string;
}
