import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../datenbank/prisma.client';
import { redisVerbindung } from '../jobs/queue';
import { telefonNormalisieren } from '../hilfsfunktionen/telefon.formatierung';
import { sofortigenAnrufPlanen } from '../dienste/anruf.dienst';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { logger } from '../hilfsfunktionen/logger';

/**
 * Oeffentliche Demo-Anruf-Routen. Ein Interessent oeffnet
 * /demo/<kampagneSlug> im Frontend, gibt Name + Telefon ein, und die
 * KI der entsprechenden Kampagne ruft ihn innerhalb von 5-10 Sekunden an.
 *
 * Sicherheit: nur Kampagnen mit istDemoVerfuegbar=true sind nutzbar.
 * Rate-Limit: 3 Anrufe pro Stunde pro IP, 1 Anruf pro 10 Minuten pro Telefonnummer.
 */
export const demoRouter = Router();

// ──────────────────────────────────────────────────────────
// Rate-Limit Middleware (Redis-basiert)
// ──────────────────────────────────────────────────────────
const IP_LIMIT = 3;                    // max 3 Demos pro Stunde pro IP
const IP_WINDOW_SEC = 3600;             // 1 Stunde
const PHONE_LIMIT = 1;                  // max 1 Demo pro 10 Min pro Telefon
const PHONE_WINDOW_SEC = 600;           // 10 Minuten

async function rateLimitPruefen(
  schluessel: string,
  limit: number,
  fensterSekunden: number,
): Promise<boolean> {
  const anzahl = await redisVerbindung.incr(schluessel);
  if (anzahl === 1) {
    await redisVerbindung.expire(schluessel, fensterSekunden);
  }
  return anzahl <= limit;
}

// ──────────────────────────────────────────────────────────
// GET /api/v1/demo/:kampagneSlug — Metadaten fuer Landing Page
// ──────────────────────────────────────────────────────────
demoRouter.get('/:kampagneSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneSlug } = req.params;
    const kampagne = await prisma.kampagne.findUnique({
      where: { webhookSlug: kampagneSlug },
      select: {
        name: true,
        beschreibung: true,
        istDemoVerfuegbar: true,
        status: true,
        vapiAktiviert: true,
        kiName: true,
        kunde: { select: { name: true } },
      },
    });

    if (!kampagne || !kampagne.istDemoVerfuegbar || kampagne.status !== 'aktiv' || !kampagne.vapiAktiviert) {
      throw new AppFehler('Demo nicht verfuegbar', 404, 'DEMO_NICHT_VERFUEGBAR');
    }

    res.json({
      erfolg: true,
      daten: {
        name: kampagne.name,
        beschreibung: kampagne.beschreibung,
        kiName: kampagne.kiName,
        kundeName: kampagne.kunde?.name || null,
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/v1/demo/:kampagneSlug/anrufen — startet Demo-Anruf
// ──────────────────────────────────────────────────────────
const anrufenSchema = z.object({
  vorname: z.string().min(1, 'Vorname ist erforderlich').max(100),
  nachname: z.string().max(100).optional(),
  telefon: z.string().min(5).max(30),
  _hp: z.string().optional(), // Honeypot
});

demoRouter.post('/:kampagneSlug/anrufen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneSlug } = req.params;

    // Honeypot: Bot hat das versteckte Feld ausgefuellt → still OK antworten, nichts tun
    if (req.body?._hp) {
      logger.warn(`Demo-Honeypot getriggert fuer Slug ${kampagneSlug}`);
      res.status(200).json({ erfolg: true, daten: { geplantIn: 'sofort' } });
      return;
    }

    const daten = anrufenSchema.parse(req.body);

    const telefon = telefonNormalisieren(daten.telefon);
    if (!telefon) {
      throw new AppFehler('Ungueltige Telefonnummer. Format: +49 151 12345678', 400, 'TELEFON_UNGUELTIG');
    }

    // Rate-Limit: IP
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unbekannt';
    const ipOk = await rateLimitPruefen(`demo:ip:${ip}`, IP_LIMIT, IP_WINDOW_SEC);
    if (!ipOk) {
      throw new AppFehler(
        'Du hast in der letzten Stunde bereits mehrere Demos gestartet. Bitte in ein paar Minuten erneut versuchen.',
        429,
        'DEMO_RATE_LIMIT_IP',
      );
    }

    // Rate-Limit: Telefon
    const phoneOk = await rateLimitPruefen(`demo:phone:${telefon}`, PHONE_LIMIT, PHONE_WINDOW_SEC);
    if (!phoneOk) {
      throw new AppFehler(
        'Diese Nummer wurde gerade schon angerufen. Bitte ein paar Minuten warten.',
        429,
        'DEMO_RATE_LIMIT_TELEFON',
      );
    }

    // Kampagne laden + pruefen
    const kampagne = await prisma.kampagne.findUnique({
      where: { webhookSlug: kampagneSlug },
      select: {
        id: true,
        status: true,
        istDemoVerfuegbar: true,
        vapiAktiviert: true,
        vapiAssistantId: true,
        vapiPhoneNumberId: true,
        kundeId: true,
      },
    });

    if (!kampagne || !kampagne.istDemoVerfuegbar || kampagne.status !== 'aktiv' || !kampagne.vapiAktiviert) {
      throw new AppFehler('Demo nicht verfuegbar', 404, 'DEMO_NICHT_VERFUEGBAR');
    }

    // VAPI-Konfig pruefen (Fallback ueber Kunden-Integration)
    const { integrationKonfigurationLesenMitFallback } = await import('../dienste/integrationen.dienst');
    const vapiKonfig = await integrationKonfigurationLesenMitFallback('vapi', kampagne.kundeId);
    const assistantId = vapiKonfig?.assistant_id || kampagne.vapiAssistantId;
    const phoneNumberId = vapiKonfig?.phone_number_id || kampagne.vapiPhoneNumberId;

    if (!vapiKonfig?.api_schluessel || !assistantId || !phoneNumberId) {
      logger.error(`Demo-Kampagne ${kampagne.id} hat unvollstaendige VAPI-Konfig`);
      throw new AppFehler(
        'Demo-Konfiguration unvollstaendig. Bitte den Betreiber informieren.',
        500,
        'DEMO_KONFIG_FEHLT',
      );
    }

    // Lead direkt anlegen (kein Duplikat-Check — jeder Demo-Klick = neuer Lead)
    const lead = await prisma.lead.create({
      data: {
        kampagneId: kampagne.id,
        vorname: daten.vorname,
        nachname: daten.nachname,
        telefon,
        quelle: 'demo',
        status: 'Neu',
        rohdaten: { demo: true, ip, userAgent: req.headers['user-agent'] || '' } as object,
      },
    });

    // Sofortigen Anruf planen (5 Sek Delay ueber BullMQ)
    await sofortigenAnrufPlanen(lead.id, kampagne.id, 1);

    logger.info(`Demo-Anruf ausgeloest: Lead ${lead.id}, Kampagne ${kampagne.id}, Telefon ${telefon}`);

    res.status(201).json({
      erfolg: true,
      daten: {
        leadId: lead.id,
        geplantIn: 'sofort',
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});
