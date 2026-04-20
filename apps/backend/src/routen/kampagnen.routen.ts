import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../datenbank/prisma.client';
import { authentifizierung } from '../middleware/authentifizierung';
import {
  kampagnenAuflisten,
  kampagneErstellen,
  kampagneAbrufen,
  kampagneAktualisieren,
  kampagneDuplizieren,
} from '../dienste/kampagnen.dienst';
import { kampagneInhalteMitBibliothek } from '../dienste/ki-generierung.dienst';

export const kampagnenRouter = Router();
kampagnenRouter.use(authentifizierung);

const kampagneErstellenSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  beschreibung: z.string().optional(),
  triggerTyp: z.enum(['facebook_lead_ads', 'webhook', 'email', 'whatsapp', 'webformular']),
  triggerKonfiguration: z.record(z.unknown()).optional(),
  pipelineSpalten: z.array(z.string()).optional(),
  vapiAktiviert: z.boolean().optional(),
  vapiAssistantId: z.string().optional().nullable(),
  vapiPhoneNumberId: z.string().optional().nullable(),
  vapiPrompt: z.string().optional().nullable(),
  vapiErsteBotschaft: z.string().optional().nullable(),
  vapiVoicemailNachricht: z.string().optional().nullable(),
  maxAnrufVersuche: z.number().int().min(1).max(20).optional(),
  anrufZeitslots: z.array(z.object({ stunde: z.number(), minute: z.number() })).optional(),
  emailAktiviert: z.boolean().optional(),
  whatsappAktiviert: z.boolean().optional(),
  benachrichtigungEmail: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  calendlyLink: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  branche: z.string().optional().nullable(),
  produkt: z.string().optional().nullable(),
  zielgruppe: z.string().optional().nullable(),
  ton: z.string().optional().nullable(),
  kiName: z.string().optional().nullable(),
  kiGeschlecht: z.string().optional().nullable(),
  kiSprachstil: z.string().optional().nullable(),
  emailTemplateVerpasst: z.string().optional().nullable(),
  emailTemplateVoicemail: z.string().optional().nullable(),
  emailTemplateUnerreichbar: z.string().optional().nullable(),
  emailTemplateTerminBestaetigung: z.string().optional().nullable(),
  emailTemplateRueckruf: z.string().optional().nullable(),
  emailTemplateNichtInteressiert: z.string().optional().nullable(),
  whatsappTemplateVerpasst: z.string().optional().nullable(),
  whatsappTemplateUnerreichbar: z.string().optional().nullable(),
  whatsappTemplateNichtInteressiert: z.string().optional().nullable(),
  whatsappKanalId: z.string().optional().nullable(),
  whatsappAnbieter: z.enum(['superchat', 'meta']).optional(),
  whatsappMetaPhoneNumberId: z.string().optional().nullable(),
  whatsappTemplateVerpasstName: z.string().optional().nullable(),
  whatsappTemplateVerpasstSprache: z.string().optional().nullable(),
  whatsappTemplateUnerreichbarName: z.string().optional().nullable(),
  whatsappTemplateUnerreichbarSprache: z.string().optional().nullable(),
  whatsappTemplateNichtInteressiertName: z.string().optional().nullable(),
  whatsappTemplateNichtInteressiertSprache: z.string().optional().nullable(),
  kundeId: z.string().optional().nullable(),
  felder: z.array(z.object({
    feldname: z.string().min(1),
    bezeichnung: z.string().min(1),
    feldtyp: z.enum(['text', 'zahl', 'email', 'telefon', 'datum', 'auswahl', 'ja_nein', 'mehrzeilig']),
    pflichtfeld: z.boolean().optional(),
    optionen: z.unknown().optional(),
    reihenfolge: z.number().optional(),
    platzhalter: z.string().optional(),
    hilfetext: z.string().optional(),
  })).optional(),
});

const kampagneAktualisierenSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  beschreibung: z.string().optional(),
  status: z.enum(['aktiv', 'pausiert', 'archiviert']).optional(),
  triggerKonfiguration: z.record(z.unknown()).optional(),
  pipelineSpalten: z.array(z.string()).optional(),
  vapiAktiviert: z.boolean().optional(),
  vapiAssistantId: z.string().optional().nullable(),
  vapiPhoneNumberId: z.string().optional().nullable(),
  vapiPrompt: z.string().optional().nullable(),
  vapiErsteBotschaft: z.string().optional().nullable(),
  vapiVoicemailNachricht: z.string().optional().nullable(),
  maxAnrufVersuche: z.number().int().min(1).max(20).optional(),
  anrufZeitslots: z.array(z.object({ stunde: z.number(), minute: z.number() })).optional(),
  emailAktiviert: z.boolean().optional(),
  whatsappAktiviert: z.boolean().optional(),
  benachrichtigungEmail: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  calendlyLink: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  branche: z.string().optional().nullable(),
  produkt: z.string().optional().nullable(),
  zielgruppe: z.string().optional().nullable(),
  ton: z.string().optional().nullable(),
  kiName: z.string().optional().nullable(),
  kiGeschlecht: z.string().optional().nullable(),
  kiSprachstil: z.string().optional().nullable(),
  emailTemplateVerpasst: z.string().optional().nullable(),
  emailTemplateVoicemail: z.string().optional().nullable(),
  emailTemplateUnerreichbar: z.string().optional().nullable(),
  emailTemplateTerminBestaetigung: z.string().optional().nullable(),
  emailTemplateRueckruf: z.string().optional().nullable(),
  emailTemplateNichtInteressiert: z.string().optional().nullable(),
  whatsappTemplateVerpasst: z.string().optional().nullable(),
  whatsappTemplateUnerreichbar: z.string().optional().nullable(),
  whatsappTemplateNichtInteressiert: z.string().optional().nullable(),
  whatsappKanalId: z.string().optional().nullable(),
  whatsappAnbieter: z.enum(['superchat', 'meta']).optional(),
  whatsappMetaPhoneNumberId: z.string().optional().nullable(),
  whatsappTemplateVerpasstName: z.string().optional().nullable(),
  whatsappTemplateVerpasstSprache: z.string().optional().nullable(),
  whatsappTemplateUnerreichbarName: z.string().optional().nullable(),
  whatsappTemplateUnerreichbarSprache: z.string().optional().nullable(),
  whatsappTemplateNichtInteressiertName: z.string().optional().nullable(),
  whatsappTemplateNichtInteressiertSprache: z.string().optional().nullable(),
  kundeId: z.string().optional().nullable(),
});

// GET /api/v1/kampagnen
kampagnenRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Papierkorb: gelöschte Kampagnen anzeigen
    if (req.query.papierkorb === 'true') {
      const geloeschte = await prisma.kampagne.findMany({
        where: { geloescht: true },
        include: { _count: { select: { leads: true } } },
        orderBy: { geloeschtAm: 'desc' },
      });
      res.json({ erfolg: true, daten: { eintraege: geloeschte } });
      return;
    }

    const ergebnis = await kampagnenAuflisten({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      kundeId: typeof req.query.kunde_id === 'string' ? req.query.kunde_id : undefined,
      seite: typeof req.query.seite === 'string' ? parseInt(req.query.seite) : undefined,
      proSeite: typeof req.query.pro_seite === 'string' ? parseInt(req.query.pro_seite) : undefined,
    });

    res.json({ erfolg: true, daten: ergebnis });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kampagnen
kampagnenRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = kampagneErstellenSchema.parse(req.body);
    const kampagne = await kampagneErstellen({
      ...daten,
      triggerKonfiguration: daten.triggerKonfiguration as Prisma.InputJsonValue | undefined,
      felder: daten.felder?.map((f) => ({
        ...f,
        optionen: f.optionen as Prisma.InputJsonValue | undefined,
      })),
      erstelltVon: req.benutzer!.benutzerId,
    });

    res.status(201).json({ erfolg: true, daten: kampagne });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kampagnen/ki-generieren
const kiGenerierungSchema = z.object({
  branche: z.string().min(1, 'Branche ist erforderlich'),
  produkt: z.string().min(1, 'Produkt ist erforderlich'),
  zielgruppe: z.string().min(1, 'Zielgruppe ist erforderlich'),
  ton: z.string().min(1, 'Ton ist erforderlich'),
  firmenname: z.string().optional(),
  kiName: z.string().optional(),
  kiGeschlecht: z.string().optional(),
  kiSprachstil: z.string().optional(),
  zusatzFelder: z.array(z.string()).optional(),
});

kampagnenRouter.post('/ki-generieren', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = kiGenerierungSchema.parse(req.body);
    const ergebnis = await kampagneInhalteMitBibliothek(daten);
    res.json({ erfolg: true, daten: ergebnis });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kampagnen/:id
kampagnenRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kampagne = await kampagneAbrufen(req.params.id);
    res.json({ erfolg: true, daten: kampagne });
  } catch (fehler) {
    next(fehler);
  }
});

// PATCH /api/v1/kampagnen/:id
kampagnenRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = kampagneAktualisierenSchema.parse(req.body);
    const kampagne = await kampagneAktualisieren(req.params.id, {
      ...daten,
      triggerKonfiguration: daten.triggerKonfiguration as Prisma.InputJsonValue | undefined,
      anrufZeitslots: daten.anrufZeitslots as Prisma.InputJsonValue | undefined,
    });
    res.json({ erfolg: true, daten: kampagne });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/kampagnen/:id (Soft Delete → Papierkorb)
kampagnenRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kampagne = await prisma.kampagne.update({
      where: { id: req.params.id },
      data: { geloescht: true, geloeschtAm: new Date(), status: 'archiviert' },
    });
    res.json({ erfolg: true, daten: kampagne });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kampagnen/:id/wiederherstellen
kampagnenRouter.post('/:id/wiederherstellen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kampagne = await prisma.kampagne.update({
      where: { id: req.params.id },
      data: { geloescht: false, geloeschtAm: null, status: 'pausiert' },
    });
    res.json({ erfolg: true, daten: kampagne });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/kampagnen/:id/endgueltig (endgültig löschen)
kampagnenRouter.delete('/:id/endgueltig', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.kampagne.delete({ where: { id: req.params.id } });
    res.json({ erfolg: true, nachricht: 'Kampagne endgültig gelöscht.' });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kampagnen/:id/duplizieren
kampagnenRouter.post('/:id/duplizieren', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kampagne = await kampagneDuplizieren(req.params.id, req.benutzer!.benutzerId);
    res.status(201).json({ erfolg: true, daten: kampagne });
  } catch (fehler) {
    next(fehler);
  }
});
