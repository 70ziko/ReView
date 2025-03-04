import session from 'express-session';
import { RequestHandler } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export const sessionMiddleware: RequestHandler = session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

// Middleware to ensure userId exists
export const ensureUserId: RequestHandler = (req, _res, next) => {
    if (!req.session.userId) {
        req.session.userId = Math.random().toString(36).substring(2, 15) + 
                            Math.random().toString(36).substring(2, 15);
    }
    next();
};
