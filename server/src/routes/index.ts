import { Request, Response } from 'express';
import { Router } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
    res.send('Hello, World!');
});

router.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK' });
});

