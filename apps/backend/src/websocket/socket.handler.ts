import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../hilfsfunktionen/logger';

let io: Server | null = null;

interface TokenNutzlast {
  benutzerId: string;
  email: string;
  rolle: string;
}

export function socketServerInitialisieren(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authentifizierung für WebSocket-Verbindungen
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      next(new Error('Authentifizierung erforderlich'));
      return;
    }

    const geheimnis = process.env.JWT_GEHEIMNIS;
    if (!geheimnis) {
      next(new Error('Server-Konfigurationsfehler'));
      return;
    }

    try {
      const nutzlast = jwt.verify(token, geheimnis) as TokenNutzlast;
      (socket as Socket & { benutzer: TokenNutzlast }).benutzer = nutzlast;
      next();
    } catch {
      next(new Error('Ungültiger Token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const benutzer = (socket as Socket & { benutzer: TokenNutzlast }).benutzer;
    logger.info(`WebSocket verbunden: ${benutzer.email}`);

    // Kampagnen-Raum beitreten
    socket.on('kampagne:beitreten', (kampagneId: string) => {
      socket.join(`kampagne:${kampagneId}`);
      logger.debug(`${benutzer.email} trat Kampagne ${kampagneId} bei`);
    });

    // Kampagnen-Raum verlassen
    socket.on('kampagne:verlassen', (kampagneId: string) => {
      socket.leave(`kampagne:${kampagneId}`);
    });

    socket.on('disconnect', () => {
      logger.debug(`WebSocket getrennt: ${benutzer.email}`);
    });
  });

  logger.info('WebSocket-Server initialisiert');
  return io;
}

export function socketServer(): Server | null {
  return io;
}
