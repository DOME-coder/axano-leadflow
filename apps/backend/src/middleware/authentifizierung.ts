import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppFehler } from './fehlerbehandlung';

interface TokenNutzlast {
  benutzerId: string;
  email: string;
  rolle: string;
  /** Nur gesetzt bei Rolle "kunde" — verweist auf zugehoerigen Kunden-Datensatz */
  kundeId?: string;
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

/**
 * Blockt Zugriff wenn Rolle nicht "admin".
 * Fuer Benutzer-Verwaltung und globale Integrationen.
 */
export function nurAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.benutzer?.rolle !== 'admin') {
    next(new AppFehler('Nur Administratoren haben Zugriff', 403, 'NICHT_AUTORISIERT'));
    return;
  }
  next();
}

/**
 * Blockt Zugriff von Kunden-Rolle. Erlaubt nur "admin" und "mitarbeiter".
 * Wird auf alle authenticated-Routen angewendet, die nicht kundenspezifisch sind
 * (Kampagnen, Leads, Automatisierungen, Templates, Analytics usw.).
 */
export function nurAdminOderMitarbeiter(req: Request, _res: Response, next: NextFunction): void {
  const rolle = req.benutzer?.rolle;
  if (rolle !== 'admin' && rolle !== 'mitarbeiter') {
    next(new AppFehler('Diese Ressource ist nur fuer das Axano-Team zugaenglich', 403, 'NICHT_AUTORISIERT'));
    return;
  }
  next();
}

/**
 * Erlaubt Zugriff nur wenn der Benutzer auf den in der URL referenzierten Kunden zugreifen darf.
 * Admin und Mitarbeiter kommen mit beliebigem kundeId durch.
 * Kunden-Rolle nur, wenn `req.params[paramName] === req.benutzer.kundeId`.
 *
 * Beispiel: `router.use('/:kundeId/integrationen', kundenSelbstzugriff('kundeId'))`
 */
export function kundenSelbstzugriff(paramName: string) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const rolle = req.benutzer?.rolle;
    if (rolle === 'admin' || rolle === 'mitarbeiter') {
      next();
      return;
    }
    if (rolle === 'kunde') {
      const paramWert = req.params[paramName];
      if (paramWert && paramWert === req.benutzer?.kundeId) {
        next();
        return;
      }
      next(new AppFehler('Zugriff auf diesen Kunden nicht erlaubt', 403, 'NICHT_AUTORISIERT'));
      return;
    }
    next(new AppFehler('Authentifizierung erforderlich', 401, 'NICHT_AUTHENTIFIZIERT'));
  };
}
