import { Router, Request, Response, NextFunction } from 'express';
import { leadPerTokenAbmelden } from '../dienste/email.dienst';

export const abmeldenRouter = Router();

/**
 * GET /api/v1/abmelden/:token
 * Liest den Abmelde-Status fuer das Frontend (Bestaetigungsseite).
 * Setzt den Lead beim ersten Aufruf auf abgemeldet (idempotent).
 *
 * Public Endpoint (kein Auth) — der Token ist die Authentifizierung.
 */
abmeldenRouter.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ erfolg: false, fehler: 'Token fehlt' });
      return;
    }
    const ergebnis = await leadPerTokenAbmelden(token);
    if (!ergebnis) {
      res.status(404).json({ erfolg: false, fehler: 'Abmelde-Link ungueltig oder abgelaufen' });
      return;
    }
    res.json({
      erfolg: true,
      daten: {
        bereitsAbgemeldet: ergebnis.bereitsAbgemeldet,
        // E-Mail nur zur Bestaetigung in der UI, gekuerzt
        email: ergebnis.email
          ? ergebnis.email.replace(/(.).*?(@.*)/, '$1***$2')
          : null,
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});

/**
 * POST /api/v1/abmelden/:token
 * One-Click-Unsubscribe (RFC 8058). Wird von Mail-Clients (Gmail, Apple Mail, …)
 * automatisch aufgerufen, wenn der User auf "Abmelden" im Mail-Header klickt.
 */
abmeldenRouter.post('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;
    if (!token || typeof token !== 'string') {
      res.status(400).send('Token fehlt');
      return;
    }
    const ergebnis = await leadPerTokenAbmelden(token);
    if (!ergebnis) {
      res.status(404).send('Abmelde-Link ungueltig');
      return;
    }
    res.status(200).send('OK');
  } catch (fehler) {
    next(fehler);
  }
});
