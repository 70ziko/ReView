import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import session from 'express-session';
import { IncomingMessage } from 'http';
import routes from './routes/index.js';
import { graphRagAgent } from './lib/ai/index.js';
import { initializeDatabase } from './services/db/index.js';

dotenv.config({ path: '../.env' });

const app: Express = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
    },
});

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(sessionMiddleware);
interface SessionIncomingMessage extends IncomingMessage {
    session: any;
}

interface SessionSocket extends Socket {
    request: SessionIncomingMessage;
}

// Make session available in Socket.IO
const wrap = (middleware: any) => (socket: any, next: any) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

app.use('/api', (req, _res, next) => {
    if (!req.session.userId) {
      req.session.userId = Math.random().toString(36).substring(2, 15) + 
                            Math.random().toString(36).substring(2, 15);
    }
    next();
  }, routes);

io.on('connection', (socket: Socket) => {
    const sessionSocket = socket as SessionSocket;
    const session = sessionSocket.request.session;
    console.log(`Client connected: ${socket.id}`);
    // Initialize user session if needed
    if (!session) {
        sessionSocket.request.session = { chatHistory: [] };
        sessionSocket.request.session.save();
    }

    sessionSocket.on('chat:message', async (data: { message: string }) => {
        try {
            session.save();
            
            await graphRagAgent.processMessage(data.message, (chunk) => {
                sessionSocket.emit('chat:response:chunk', { chunk });
            });
            
            sessionSocket.emit('chat:response:done');
        } catch (error) {
            console.error('Error processing chat message:', error);
            sessionSocket.emit('chat:error', { error: 'Failed to process your message' });
        }
    });

    sessionSocket.on('chat:message:image', async (data: { message: string, imageData: string }) => {
        try {
            session.save();
            
            await graphRagAgent.processMessageWithImage(
                data.message,
                data.imageData,
                (chunk) => {
                    sessionSocket.emit('chat:response:chunk', { chunk });
                }
            );
            
            sessionSocket.emit('chat:response:done');
        } catch (error) {
            console.error('Error processing chat message with image:', error);
            sessionSocket.emit('chat:error', { error: 'Failed to process your message with image' });
        }
    });

    sessionSocket.on('chat:clear', async () => {
        try {
            await graphRagAgent.clearHistory();
            // Clear session chat history
            session.save();
            sessionSocket.emit('chat:cleared');
        } catch (error) {
            console.error('Error clearing chat history:', error);
            sessionSocket.emit('chat:error', { error: 'Failed to clear chat history' });
        }
    });

    sessionSocket.on('chat:get_history', () => {
        sessionSocket.emit('chat:history', { history: session.chatHistory || [] });
    });

    sessionSocket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

app.get('/', (_req: Request, res: Response) => {
    res.send('ReView API Server is running');
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
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