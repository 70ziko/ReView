import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { createServer } from "http";
import routes from "./api/routes/index.js";
import { sessionMiddleware, ensureUserId } from "./middleware/session.js";
import { configureSocketIO, wrapMiddleware } from "./socket/config.js";
import { setupChatSocket } from "./socket/chat.js";
import { chatProductAssistant } from "./lib/ai/index.js";
import path from "path";

// Load environment variables
dotenv.config({ path: "../.env" });

// Create Express app and HTTP server
const app: Express = express();
const httpServer = createServer(app);

// Configure Socket.IO
const io = configureSocketIO(httpServer, process.env.CORS_ORIGIN || "*");

// Configure CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type']
}));

// Configure middleware
app.use(morgan("dev")); // Logging
app.use(sessionMiddleware); // Session handling

// Handle JSON requests - except for multipart routes that will be handled by multer
app.use((req, res, next) => {
  // Skip JSON parsing for multipart requests
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next();
  }
  express.json({ limit: "50mb" })(req, res, next);
});

// Handle URL-encoded requests - except for multipart routes
app.use((req, res, next) => {
  // Skip URL encoding for multipart requests
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: "50mb" })(req, res, next);
});

// Set up uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Configure Socket.IO with session
io.use(wrapMiddleware(sessionMiddleware));

// Configure API routes with user ID
app.use("/api", ensureUserId, routes);

// Set up chat socket
setupChatSocket(io, chatProductAssistant);

// Home route
app.get("/", (_req: Request, res: Response) => {
  res.send("ReView API Server is running");
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Upload directory: ${path.join(process.cwd(), 'uploads')}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();