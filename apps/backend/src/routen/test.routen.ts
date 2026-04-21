import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authentifizierung, nurAdminOderMitarbeiter } from '../middleware/authentifizierung';
import { leadErstellen } from '../dienste/lead.dienst';
import { prisma } from '../datenbank/prisma.client';
import { logger } from '../hilfsfunktionen/logger';

export const testRouter = Router();
testRouter.use(authentifizierung);
testRouter.use(nurAdminOderMitarbeiter);

const testLeadSchema = z.object({
  kampagneSlug: z.string().min(1, 'Kampagne-Slug ist erforderlich'),
  vorname: z.string().min(1, 'Vorname ist erforderlich'),
  nachname: z.string().min(1, 'Nachname ist erforderlich'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  telefon: z.string().min(5, 'Telefonnummer ist erforderlich'),
  zusatzFelder: z.record(z.string()).optional(),
});

/**
 * POST /api/v1/test/facebook-lead
 * Simuliert einen Facebook-Lead für End-to-End-Tests.
 * Nur in Entwicklung/Staging verfügbar.
 */
testRouter.post('/facebook-lead', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Nur in Entwicklung/Staging erlauben
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        erfolg: false,
        fehler: 'Test-Endpunkt ist in Produktion nicht verfügbar.',
      });
      return;
    }

    const daten = testLeadSchema.parse(req.body);

    // Kampagne anhand des Slugs finden
    const kampagne = await prisma.kampagne.findUnique({
      where: { webhookSlug: daten.kampagneSlug },
    });

    if (!kampagne) {
      res.status(404).json({
        erfolg: false,
        fehler: `Kampagne mit Slug "${daten.kampagneSlug}" nicht gefunden.`,
      });
      return;
    }

    logger.info(`Test-Lead wird erstellt für Kampagne "${kampagne.name}" (${kampagne.id})`);

    // Lead über den normalen Dienst erstellen (gleiche Pipeline wie Facebook-Webhook)
    const lead = await leadErstellen({
      kampagneId: kampagne.id,
      vorname: daten.vorname,
      nachname: daten.nachname,
      email: daten.email,
      telefon: daten.telefon,
      quelle: 'test',
      rohdaten: {
        testModus: true,
        erstelltVon: req.benutzer!.benutzerId,
        erstelltAm: new Date().toISOString(),
        ...daten.zusatzFelder,
      },
      felddaten: daten.zusatzFelder,
    });

    logger.info(`Test-Lead erstellt: ${lead.id} – Pipeline wird automatisch gestartet`);

    res.status(201).json({
      erfolg: true,
      daten: {
        leadId: lead.id,
        kampagneId: kampagne.id,
        kampagneName: kampagne.name,
        status: lead.status,
        hinweis: 'Lead wurde erstellt und die Anruf-Pipeline wird automatisch gestartet (sofern VAPI aktiviert ist).',
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});
