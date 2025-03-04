import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import routes from './api/routes/index.js';
import { initializeDatabase } from './services/db/index.js';
import { sessionMiddleware, ensureUserId } from './middleware/session.js';
import { configureSocketIO, wrapMiddleware } from './socket/config.js';
import { setupChatSocket } from './socket/chat.js';
import { ragChatAssistant } from './lib/ai/index.js';

dotenv.config({ path: '../.env' });

const app: Express = express();
const httpServer = createServer(app);

const io = configureSocketIO(httpServer, process.env.CORS_ORIGIN || '*');

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(sessionMiddleware);

io.use(wrapMiddleware(sessionMiddleware));

app.use('/api', ensureUserId, routes);

setupChatSocket(io, ragChatAssistant);

app.get('/', (_req: Request, res: Response) => {
    res.send('ReView API Server is running');
});

app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await initializeDatabase();
        
        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
