import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../datenbank/prisma.client';
import { authentifizierung, nurAdminOderMitarbeiter } from '../middleware/authentifizierung';
import { anrufSequenzStarten, sofortigenAnrufPlanen } from '../dienste/anruf.dienst';

export const anrufeRouter = Router();
anrufeRouter.use(authentifizierung);
anrufeRouter.use(nurAdminOderMitarbeiter);

// Kampagnen-spezifische Anruf-Routen
export const kampagneAnrufeRouter = Router({ mergeParams: true });
kampagneAnrufeRouter.use(authentifizierung);
kampagneAnrufeRouter.use(nurAdminOderMitarbeiter);

// GET /api/v1/kampagnen/:kampagneId/anrufe
kampagneAnrufeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneId } = req.params;
    const seite = typeof req.query.seite === 'string' ? parseInt(req.query.seite) : 1;
    const proSeite = 50;
    const skip = (seite - 1) * proSeite;

    const [anrufe, gesamt] = await Promise.all([
      prisma.anrufVersuch.findMany({
        where: { kampagneId },
        include: {
          lead: { select: { id: true, vorname: true, nachname: true, email: true, telefon: true, status: true } },
        },
        orderBy: { erstelltAm: 'desc' },
        skip,
        take: proSeite,
      }),
      prisma.anrufVersuch.count({ where: { kampagneId } }),
    ]);

    res.json({ erfolg: true, daten: { eintraege: anrufe, gesamt, seite, proSeite } });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kampagnen/:kampagneId/anrufe/starten – Manuell Sequenz für alle Leads starten
// die noch kein Endstatus haben und noch keinen aktiven Anrufversuch.
kampagneAnrufeRouter.post('/starten', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneId } = req.params;

    // Alle Leads mit Telefon, die noch nicht finalisiert wurden
    const beendendeStatus = ['Termin gebucht', 'Nicht interessiert', 'Falsche Nummer', 'Nicht erreichbar', 'WhatsApp erhalten'];
    const kandidaten = await prisma.lead.findMany({
      where: {
        kampagneId,
        geloescht: false,
        telefon: { not: null },
        status: { notIn: beendendeStatus },
      },
      include: {
        anrufVersuche: {
          where: { status: { in: ['geplant', 'laeuft'] } },
          select: { id: true },
        },
      },
    });

    let gestartet = 0;
    let uebersprungen = 0;
    for (const lead of kandidaten) {
      if (lead.anrufVersuche.length > 0) {
        // Bereits ein geplanter oder laufender Anruf — nicht doppelt planen
        uebersprungen++;
        continue;
      }
      await anrufSequenzStarten(lead.id, kampagneId);
      gestartet++;
    }

    const nachricht = gestartet === 0
      ? (kandidaten.length === 0
          ? 'Keine Leads mit Telefonnummer in offenem Status gefunden.'
          : `Keine neuen Anrufe geplant – ${uebersprungen} Leads haben bereits geplante oder laufende Anrufe.`)
      : `${gestartet} Anruf-Sequenz(en) gestartet${uebersprungen > 0 ? ` (${uebersprungen} übersprungen)` : ''}`;

    res.json({
      erfolg: true,
      daten: { gestartet, uebersprungen, gesamt: kandidaten.length },
      nachricht,
    });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/leads/:leadId/anruf-sofort – Einzelnen Lead SOFORT anrufen (Test-Modus)
// Umgeht Zeitslot-Routing, ignoriert evtl. geplante Anrufe und startet binnen 5 Sek.
anrufeRouter.post('/lead/:leadId/sofort', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.leadId },
      include: { kampagne: { select: { id: true, vapiAktiviert: true } } },
    });

    if (!lead || lead.geloescht) {
      res.status(404).json({ erfolg: false, fehler: 'Lead nicht gefunden' });
      return;
    }
    if (!lead.telefon) {
      res.status(400).json({ erfolg: false, fehler: 'Lead hat keine Telefonnummer' });
      return;
    }
    if (!lead.kampagne?.vapiAktiviert) {
      res.status(400).json({ erfolg: false, fehler: 'VAPI ist für diese Kampagne nicht aktiviert' });
      return;
    }

    // Laufende oder geplante Anrufe zuerst abbrechen
    await prisma.anrufVersuch.updateMany({
      where: { leadId: lead.id, status: { in: ['geplant', 'laeuft'] } },
      data: { status: 'fehler', fehlerNachricht: 'Durch manuellen Sofort-Anruf ersetzt' },
    });

    const letzterVersuch = await prisma.anrufVersuch.findFirst({
      where: { leadId: lead.id },
      orderBy: { versuchNummer: 'desc' },
      select: { versuchNummer: true },
    });
    const naechsteVersuchNummer = (letzterVersuch?.versuchNummer || 0) + 1;

    // Lead-Status zuruecksetzen falls nicht im Endzustand, damit der Worker ihn nicht ueberspringt
    const beendendeStatus = ['Termin gebucht', 'Nicht interessiert', 'Falsche Nummer', 'Nicht erreichbar', 'WhatsApp erhalten'];
    if (beendendeStatus.includes(lead.status)) {
      res.status(400).json({
        erfolg: false,
        fehler: `Lead hat Endstatus "${lead.status}". Bitte Status manuell aendern, bevor ein neuer Anruf gestartet wird.`,
      });
      return;
    }

    await sofortigenAnrufPlanen(lead.id, lead.kampagne.id, naechsteVersuchNummer);

    res.json({
      erfolg: true,
      nachricht: `Sofortiger Anruf geplant (startet binnen 5 Sekunden, Versuch #${naechsteVersuchNummer})`,
    });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/anrufe/:id – Einzelner Anrufversuch mit Transkript
anrufeRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const anruf = await prisma.anrufVersuch.findUnique({
      where: { id: req.params.id },
      include: {
        lead: { select: { id: true, vorname: true, nachname: true, email: true, telefon: true } },
      },
    });

    if (!anruf) {
      res.status(404).json({ erfolg: false, fehler: 'Anruf nicht gefunden' });
      return;
    }

    res.json({ erfolg: true, daten: anruf });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/anrufe/:id/wiederholen – Manuell erneut anrufen
anrufeRouter.post('/:id/wiederholen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const anruf = await prisma.anrufVersuch.findUnique({
      where: { id: req.params.id },
    });

    if (!anruf) {
      res.status(404).json({ erfolg: false, fehler: 'Anruf nicht gefunden' });
      return;
    }

    await anrufSequenzStarten(anruf.leadId, anruf.kampagneId);
    res.json({ erfolg: true, nachricht: 'Neue Anruf-Sequenz gestartet' });
  } catch (fehler) {
    next(fehler);
  }
});
