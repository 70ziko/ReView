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
import { prettyLog } from "./lib/loggers/index.js";
import { initializeDatabase } from "./services/db/index.js";

prettyLog.configure({
  showTimestamp: true,
  showLevel: true,
  colors: true,
});

dotenv.config({ path: "../.env" });

const app: Express = express();
const httpServer = createServer(app);

const io = configureSocketIO(httpServer, process.env.CORS_ORIGIN || "*");

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type']
}));

app.use(morgan("dev")); // Logging
app.use(sessionMiddleware); // Session handling

app.use((req, res, next) => {
  // skip JSON parsing for multipart requests
  if (
    req.headers["content-type"] &&
    req.headers["content-type"].includes("multipart/form-data")
  ) {
    return next();
  }
  express.json({ limit: "50mb" })(req, res, next);
});

app.use((req, res, next) => {
  // skip URL encoding for multipart requests
  if (
    req.headers["content-type"] &&
    req.headers["content-type"].includes("multipart/form-data")
  ) {
    return next();
  }
  express.urlencoded({ extended: true, limit: "50mb" })(req, res, next);
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

io.use(wrapMiddleware(sessionMiddleware));

app.use("/api", ensureUserId, routes);

setupChatSocket(io, chatProductAssistant);

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

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  initializeDatabase();
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