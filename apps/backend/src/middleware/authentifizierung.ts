import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppFehler } from './fehlerbehandlung';

interface TokenNutzlast {
  benutzerId: string;
  email: string;
  rolle: string;
}

declare global {
  namespace Express {
    interface Request {
      benutzer?: TokenNutzlast;
    }
  }
}

export function authentifizierung(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppFehler('Authentifizierung erforderlich', 401, 'NICHT_AUTHENTIFIZIERT');
    }

    const token = authHeader.substring(7);
    const geheimnis = process.env.JWT_GEHEIMNIS;

    if (!geheimnis) {
      throw new AppFehler('Server-Konfigurationsfehler', 500, 'KONFIG_FEHLER');
    }

    const nutzlast = jwt.verify(token, geheimnis) as TokenNutzlast;
    req.benutzer = nutzlast;
    next();
  } catch (fehler) {
    if (fehler instanceof AppFehler) {
      next(fehler);
      return;
    }
    next(new AppFehler('Ungültiger oder abgelaufener Token', 401, 'TOKEN_UNGUELTIG'));
  }
}

export function nurAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.benutzer?.rolle !== 'admin') {
    next(new AppFehler('Nur Administratoren haben Zugriff', 403, 'NICHT_AUTORISIERT'));
    return;
  }
  next();
}
