import { Socket } from 'socket.io';
import { IncomingMessage } from 'http';
import { Session } from 'express-session';

interface SessionIncomingMessage extends IncomingMessage {
    session: Session & {
        userId: string;
        chatHistory: any[];
    };
}

export interface SessionSocket extends Socket {
    request: SessionIncomingMessage;
}
