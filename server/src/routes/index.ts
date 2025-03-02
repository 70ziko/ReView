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

export default router;
