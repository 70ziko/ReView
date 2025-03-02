import { Request, Response } from 'express';
import { Router } from 'express';
import { graphRagAgent } from '../lib/ai/index.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
    res.send('Hello, World!');
});

router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK' });
});

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;
        
        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }
        
        const response = await graphRagAgent.processMessage(message);
        res.json({ response });
    } catch (error) {
        console.error('Error processing chat message:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

router.post('/chat/image', async (req: Request, res: Response): Promise<void> => {
    try {
        const { message, imageData, isUrl } = req.body;
        
        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }
        if (!imageData) {
            res.status(400).json({ error: 'Image data is required' });
            return;
        }
        
        const response = await graphRagAgent.processMessageWithImage(
            message,
            imageData,
            isUrl === true
        );
        
        res.json({ response });
    } catch (error) {
        console.error('Error processing image chat message:', error);
        res.status(500).json({ error: 'Failed to process message with image' });
    }
});

router.post('/chat/clear', async (_req: Request, res: Response): Promise<void> => {
    try {
        await graphRagAgent.clearHistory();
        res.json({ status: 'success', message: 'Chat history cleared' });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

// Dummy route for image processing and product information
router.post('/image/process', async (req: Request, res: Response): Promise<void> => {
    try {
        const { imageData } = req.body;
        
        if (!imageData) {
            res.status(400).json({ error: 'Image data is required' });
            return;
        }
        // In a real implementation, this would process the image
        // Here we're returning dummy data
        
        const dummyResponse = {
            product_name: "Premium Bluetooth Headphones",
            score: 5,
            image_url: "https://example.com/images/headphones.jpg",
            general_review: "High-quality wireless headphones with excellent sound quality and comfortable fit. Battery life could be improved.",
            amazon_reviews_ref: "https://amazon.com/product/123456/reviews",
            alternatives: [
                {
                    name: "Budget Bluetooth Headphones",
                    product_id: "BT78901",
                    score: 72
                },
                {
                    name: "Premium Wired Headphones",
                    product_id: "WH45678",
                    score: 88
                }
            ],
            prices: {
                min: 79.99,
                avg: 94.50
            },
            product_id: "BT12345",
            category: "Electronics/Audio/Headphones"
        };
        
        setTimeout(() => {
            res.json(dummyResponse);
        }, 1500);    // delay, to simulate processing time, NEEDS A SPINNER ON UI!
        
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).json({ error: 'Failed to process image' });
    }
});

export default router;
