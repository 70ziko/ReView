import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import routes from './routes/index.js';
import { graphRagAgent } from './lib/ai/index.js';
import { initializeDatabase } from './services/db/index.js';

dotenv.config({ path: '../.env' });

const app: Express = express();
const httpServer = createServer(app);

// Set up Socket.io for WebSockets
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));  // Increased limit for base64 images
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API routes
app.use('/api', routes);

// Socket.io connection handling for real-time chat
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle chat messages
    socket.on('chat:message', async (data: { message: string }) => {
        try {
            // Process message with streaming response
            await graphRagAgent.processMessage(data.message, (chunk) => {
                socket.emit('chat:response:chunk', { chunk });
            });
            
            // Signal end of response
            socket.emit('chat:response:done');
        } catch (error) {
            console.error('Error processing chat message:', error);
            socket.emit('chat:error', { error: 'Failed to process your message' });
        }
    });

    // Handle messages with images
    socket.on('chat:message:image', async (data: { message: string, imageData: string, isUrl: boolean }) => {
        try {
            // Process message with image and streaming response
            await graphRagAgent.processMessageWithImage(
                data.message,
                data.imageData,
                data.isUrl,
                (chunk) => {
                    socket.emit('chat:response:chunk', { chunk });
                }
            );
            
            // Signal end of response
            socket.emit('chat:response:done');
        } catch (error) {
            console.error('Error processing chat message with image:', error);
            socket.emit('chat:error', { error: 'Failed to process your message with image' });
        }
    });

    // Clear chat history
    socket.on('chat:clear', async () => {
        try {
            await graphRagAgent.clearHistory();
            socket.emit('chat:cleared');
        } catch (error) {
            console.error('Error clearing chat history:', error);
            socket.emit('chat:error', { error: 'Failed to clear chat history' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Default route
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

// Initialize the database and start the server
const startServer = async () => {
    try {
        // Initialize the database
        await initializeDatabase();
        
        // Start the server
        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();