import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { RequestHandler } from 'express';
import { Request, Response } from 'express';

export function configureSocketIO(httpServer: HttpServer, corsOrigin: string): Server {
    return new Server(httpServer, {
        cors: {
            origin: corsOrigin || '*',
            methods: ['GET', 'POST'],
        },
    });
}

const createMockResponse = (): Response => {
    const res = {} as Response;
    res.clearCookie = () => res;
    res.cookie = () => res;
    res.end = () => res;
    res.json = () => res;
    res.status = () => res;
    res.send = () => res;
    return res;
};

export const wrapMiddleware = (middleware: RequestHandler) => (socket: any, next: any) => {
    middleware(socket.request as Request, createMockResponse(), next);
};
