import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../datenbank/prisma.client';
import { logger } from '../hilfsfunktionen/logger';

let io: Server | null = null;

interface TokenNutzlast {
  benutzerId: string;
  email: string;
  rolle: string;
  kundeId?: string;
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

    // Kampagnen-Raum beitreten — mit Authorization-Pruefung gegen Multi-Tenant-Leck.
    // Admin/Mitarbeiter (Axano-intern) duerfen alle Kampagnen abonnieren.
    // Kunden-Rolle nur Kampagnen ihres eigenen kundeId — sonst koennten sie via
    // gefaelschter kampagneId Lead-Events anderer Kunden mitlesen.
    socket.on('kampagne:beitreten', async (kampagneId: string) => {
      if (typeof kampagneId !== 'string' || !kampagneId) {
        socket.emit('kampagne:fehler', { kampagneId, grund: 'Ungueltige Kampagnen-ID' });
        return;
      }

      try {
        if (benutzer.rolle === 'admin' || benutzer.rolle === 'mitarbeiter') {
          socket.join(`kampagne:${kampagneId}`);
          logger.debug(`${benutzer.email} trat Kampagne ${kampagneId} bei (Rolle: ${benutzer.rolle})`);
          return;
        }

        if (benutzer.rolle === 'kunde') {
          if (!benutzer.kundeId) {
            logger.warn(`Kunden-Benutzer ${benutzer.email} ohne kundeId verweigert Kampagne ${kampagneId}`);
            socket.emit('kampagne:fehler', { kampagneId, grund: 'Kein Kunden-Kontext' });
            return;
          }
          const kampagne = await prisma.kampagne.findUnique({
            where: { id: kampagneId },
            select: { kundeId: true, geloescht: true },
          });
          if (!kampagne || kampagne.geloescht || kampagne.kundeId !== benutzer.kundeId) {
            logger.warn(`Kunden-Benutzer ${benutzer.email} (kundeId ${benutzer.kundeId}) verweigert Kampagne ${kampagneId}`);
            socket.emit('kampagne:fehler', { kampagneId, grund: 'Kein Zugriff' });
            return;
          }
          socket.join(`kampagne:${kampagneId}`);
          logger.debug(`${benutzer.email} (Kunde) trat eigener Kampagne ${kampagneId} bei`);
          return;
        }

        logger.warn(`Unbekannte Rolle "${benutzer.rolle}" bei kampagne:beitreten von ${benutzer.email}`);
        socket.emit('kampagne:fehler', { kampagneId, grund: 'Unbekannte Rolle' });
      } catch (fehler) {
        logger.error('Fehler bei kampagne:beitreten', {
          email: benutzer.email,
          kampagneId,
          error: fehler instanceof Error ? fehler.message : fehler,
        });
        socket.emit('kampagne:fehler', { kampagneId, grund: 'Server-Fehler' });
      }
    });

    // Kampagnen-Raum verlassen — kein Auth-Check noetig (man kann nur einen Raum verlassen,
    // dem man beigetreten ist).
    socket.on('kampagne:verlassen', (kampagneId: string) => {
      if (typeof kampagneId === 'string' && kampagneId) {
        socket.leave(`kampagne:${kampagneId}`);
      }
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
