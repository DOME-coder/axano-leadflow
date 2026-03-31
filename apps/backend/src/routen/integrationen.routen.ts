import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authentifizierung, nurAdmin } from '../middleware/authentifizierung';
import { integrationenAuflisten, integrationSpeichern, integrationenStatusAuflisten } from '../dienste/integrationen.dienst';
import { logger } from '../hilfsfunktionen/logger';

export const integrationenRouter = Router();
integrationenRouter.use(authentifizierung);

// GET /api/v1/integrationen/status (für alle authentifizierten Benutzer)
integrationenRouter.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await integrationenStatusAuflisten();
    res.json({ erfolg: true, daten: status });
  } catch (fehler) {
    next(fehler);
  }
});

// Ab hier nur Admin
integrationenRouter.use(nurAdmin);

// GET /api/v1/integrationen
integrationenRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationen = await integrationenAuflisten();
    res.json({ erfolg: true, daten: integrationen });
  } catch (fehler) {
    next(fehler);
  }
});

const speichernSchema = z.object({
  konfiguration: z.record(z.string()),
  aktiv: z.boolean(),
});

// PATCH /api/v1/integrationen/:name
integrationenRouter.patch('/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { konfiguration, aktiv } = speichernSchema.parse(req.body);
    const integration = await integrationSpeichern(req.params.name, konfiguration, aktiv);
    logger.info(`Integration ${req.params.name} aktualisiert von ${req.benutzer?.email}`);
    res.json({ erfolg: true, daten: integration });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/integrationen/:name/testen
integrationenRouter.post('/:name/testen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;

    switch (name) {
      case 'smtp': {
        // SMTP-Verbindungstest
        const nodemailer = await import('nodemailer');
        const konfig = req.body.konfiguration as Record<string, string>;
        const transport = nodemailer.default.createTransport({
          host: konfig.host,
          port: parseInt(konfig.port || '587'),
          secure: konfig.port === '465',
          auth: { user: konfig.benutzer, pass: konfig.passwort },
        });
        await transport.verify();
        res.json({ erfolg: true, nachricht: 'SMTP-Verbindung erfolgreich' });
        break;
      }

      case 'superchat': {
        const konfig = req.body.konfiguration as Record<string, string>;
        const antwort = await fetch(`${konfig.basis_url || 'https://api.superchat.de'}/v1/me`, {
          headers: { 'Authorization': `Bearer ${konfig.api_schluessel}` },
        });
        if (antwort.ok) {
          res.json({ erfolg: true, nachricht: 'Superchat-Verbindung erfolgreich' });
        } else {
          res.status(400).json({ erfolg: false, fehler: 'Superchat-Verbindung fehlgeschlagen' });
        }
        break;
      }

      default:
        res.json({ erfolg: true, nachricht: `Verbindungstest für ${name} nicht implementiert` });
    }
  } catch (fehler) {
    next(fehler);
  }
});
