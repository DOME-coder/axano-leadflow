import { Prisma } from '@prisma/client';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { telefonNormalisieren } from '../hilfsfunktionen/telefon.formatierung';
import { socketServer } from '../websocket/socket.handler';
import { automatisierungenAusloesen } from './automatisierung.dienst';
import { logger } from '../hilfsfunktionen/logger';

interface LeadErstellen {
  kampagneId: string;
  vorname?: string;
  nachname?: string;
  email?: string;
  telefon?: string;
  quelle?: string;
  rohdaten?: Record<string, unknown>;
  felddaten?: Record<string, string>;
}

export async function leadErstellen(daten: LeadErstellen) {
  const kampagne = await prisma.kampagne.findUnique({
    where: { id: daten.kampagneId },
    include: { felder: true },
  });

  if (!kampagne) {
    throw new AppFehler('Kampagne nicht gefunden', 404, 'KAMPAGNE_NICHT_GEFUNDEN');
  }

  if (kampagne.status !== 'aktiv') {
    throw new AppFehler('Kampagne ist nicht aktiv', 400, 'KAMPAGNE_INAKTIV');
  }

  // Telefonnummer normalisieren
  const telefon = telefonNormalisieren(daten.telefon);

  // Duplikatsprüfung
  let duplikatVon: string | null = null;
  let istDuplikat = false;

  if (daten.email || telefon) {
    const bedingungen = [];
    if (daten.email) {
      bedingungen.push({ email: daten.email });
    }
    if (telefon) {
      bedingungen.push({ telefon });
    }

    const bestehendesLead = await prisma.lead.findFirst({
      where: {
        kampagneId: daten.kampagneId,
        geloescht: false,
        OR: bedingungen,
      },
      orderBy: { erstelltAm: 'asc' },
    });

    if (bestehendesLead) {
      duplikatVon = bestehendesLead.id;
      istDuplikat = true;
    }
  }

  // Lead erstellen
  const lead = await prisma.lead.create({
    data: {
      kampagneId: daten.kampagneId,
      vorname: daten.vorname || null,
      nachname: daten.nachname || null,
      email: daten.email || null,
      telefon,
      quelle: daten.quelle || kampagne.triggerTyp,
      rohdaten: (daten.rohdaten as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      duplikatVon,
      istDuplikat,
      status: 'Neu',
    },
  });

  // Felddaten speichern
  if (daten.felddaten && Object.keys(daten.felddaten).length > 0) {
    const felddatenEintraege = [];
    for (const [feldname, wert] of Object.entries(daten.felddaten)) {
      const feld = kampagne.felder.find((f) => f.feldname === feldname);
      if (feld) {
        felddatenEintraege.push({
          leadId: lead.id,
          feldId: feld.id,
          wert: String(wert),
        });
      }
    }

    if (felddatenEintraege.length > 0) {
      await prisma.leadFelddatum.createMany({ data: felddatenEintraege });
    }
  }

  // Status-Historie erstellen
  await prisma.leadStatusHistorie.create({
    data: {
      leadId: lead.id,
      neuerStatus: 'Neu',
    },
  });

  // Aktivitätslog
  await prisma.leadAktivitaet.create({
    data: {
      leadId: lead.id,
      typ: 'lead_erstellt',
      beschreibung: `Lead erstellt via ${daten.quelle || kampagne.triggerTyp}${istDuplikat ? ' (Duplikat)' : ''}`,
    },
  });

  // Echtzeit-Benachrichtigung
  const io = socketServer();
  if (io) {
    io.to(`kampagne:${daten.kampagneId}`).emit('lead:neu', {
      lead: {
        ...lead,
        kampagneName: kampagne.name,
      },
    });
  }

  // Automatisierungen auslösen (lead_eingetroffen)
  automatisierungenAusloesen(daten.kampagneId, 'lead_eingetroffen', lead.id).catch(() => {});

  // VAPI Anruf-Sequenz starten (wenn aktiviert)
  // Hinweis: Assistant-ID wird nicht mehr hier geprueft — sie kann auch aus
  // der Kunden-Integration kommen. anrufSequenzStarten() macht den Check selbst
  // und loggt eine Warnung wenn weder Kampagne noch Kunden-Integration einen
  // Assistant haben.
  if (lead.telefon && kampagne.vapiAktiviert) {
    import('./anruf.dienst').then(({ anrufSequenzStarten }) => {
      anrufSequenzStarten(lead.id, daten.kampagneId).catch((fehler) => {
        logger.error('VAPI Sequenz-Start fehlgeschlagen:', { leadId: lead.id, error: fehler });
      });
    });
  }

  return lead;
}

export async function leadsAuflisten(filter: {
  kampagneId: string;
  status?: string;
  zugewiesenAn?: string;
  suche?: string;
  von?: string;
  bis?: string;
  seite?: number;
  proSeite?: number;
}) {
  const seite = filter.seite || 1;
  const proSeite = Math.min(filter.proSeite || 50, 100);
  const skip = (seite - 1) * proSeite;

  const where: Record<string, unknown> = {
    kampagneId: filter.kampagneId,
    geloescht: false,
  };

  if (filter.status) where.status = filter.status;
  if (filter.zugewiesenAn) where.zugewiesenAn = filter.zugewiesenAn;

  if (filter.suche) {
    where.OR = [
      { vorname: { contains: filter.suche, mode: 'insensitive' } },
      { nachname: { contains: filter.suche, mode: 'insensitive' } },
      { email: { contains: filter.suche, mode: 'insensitive' } },
      { telefon: { contains: filter.suche } },
    ];
  }

  if (filter.von || filter.bis) {
    where.erstelltAm = {};
    if (filter.von) (where.erstelltAm as Record<string, unknown>).gte = new Date(filter.von);
    if (filter.bis) (where.erstelltAm as Record<string, unknown>).lte = new Date(filter.bis);
  }

  const [eintraege, gesamt] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        zugewiesener: { select: { id: true, vorname: true, nachname: true } },
        felddaten: {
          include: { feld: { select: { feldname: true, bezeichnung: true } } },
        },
      },
      orderBy: { erstelltAm: 'desc' },
      skip,
      take: proSeite,
    }),
    prisma.lead.count({ where }),
  ]);

  // Felddaten als Objekt formatieren
  const formattiert = eintraege.map((lead) => ({
    ...lead,
    felder: Object.fromEntries(
      lead.felddaten.map((fd) => [fd.feld.feldname, fd.wert])
    ),
    felddaten: undefined,
  }));

  return { eintraege: formattiert, gesamt, seite, proSeite };
}

export async function leadAbrufen(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      kampagne: { select: { id: true, name: true, pipelineSpalten: true } },
      zugewiesener: { select: { id: true, vorname: true, nachname: true } },
      felddaten: {
        include: { feld: { select: { feldname: true, bezeichnung: true, feldtyp: true } } },
      },
      statusHistorie: { orderBy: { erstelltAm: 'desc' } },
      notizen: {
        include: { autor: { select: { vorname: true, nachname: true } } },
        orderBy: { erstelltAm: 'desc' },
      },
      aktivitaeten: { orderBy: { erstelltAm: 'desc' }, take: 50 },
      termine: { orderBy: { beginnAm: 'desc' }, take: 5 },
    },
  });

  if (!lead || lead.geloescht) {
    throw new AppFehler('Lead nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  return {
    ...lead,
    felder: Object.fromEntries(
      lead.felddaten.map((fd) => [fd.feld.feldname, { wert: fd.wert, bezeichnung: fd.feld.bezeichnung, feldtyp: fd.feld.feldtyp }])
    ),
  };
}

export async function leadLoeschen(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.geloescht) {
    throw new AppFehler('Lead nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }
  await prisma.lead.update({
    where: { id },
    data: { geloescht: true, geloeschtAm: new Date() },
  });
}

export async function leadAktualisieren(
  id: string,
  daten: { status?: string; zugewiesenAn?: string | null },
  geaendertVon?: string
) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.geloescht) {
    throw new AppFehler('Lead nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  const aktualisierung: Record<string, unknown> = {};
  if (daten.status !== undefined) aktualisierung.status = daten.status;
  if (daten.zugewiesenAn !== undefined) aktualisierung.zugewiesenAn = daten.zugewiesenAn;

  const aktualisierterLead = await prisma.lead.update({
    where: { id },
    data: aktualisierung,
    include: {
      zugewiesener: { select: { id: true, vorname: true, nachname: true } },
    },
  });

  // Status-Historie bei Statusänderung
  if (daten.status && daten.status !== lead.status) {
    await prisma.leadStatusHistorie.create({
      data: {
        leadId: id,
        alterStatus: lead.status,
        neuerStatus: daten.status,
        geaendertVon,
      },
    });

    await prisma.leadAktivitaet.create({
      data: {
        leadId: id,
        typ: 'status_geaendert',
        beschreibung: `Status geändert: ${lead.status} → ${daten.status}`,
        benutzerId: geaendertVon,
      },
    });

    // Echtzeit-Event
    const io = socketServer();
    if (io) {
      io.to(`kampagne:${lead.kampagneId}`).emit('lead:aktualisiert', {
        lead: aktualisierterLead,
        alterStatus: lead.status,
        neuerStatus: daten.status,
      });
    }

    // Automatisierungen auslösen (status_geaendert)
    automatisierungenAusloesen(lead.kampagneId, 'status_geaendert', lead.id, {
      vonStatus: lead.status,
      zuStatus: daten.status,
    }).catch(() => {});
  }

  return aktualisierterLead;
}

export async function leadNotizHinzufuegen(
  leadId: string,
  inhalt: string,
  autorId: string
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.geloescht) {
    throw new AppFehler('Lead nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  const notiz = await prisma.leadNotiz.create({
    data: { leadId, inhalt, autorId },
    include: { autor: { select: { vorname: true, nachname: true } } },
  });

  await prisma.leadAktivitaet.create({
    data: {
      leadId,
      typ: 'notiz_hinzugefuegt',
      beschreibung: 'Notiz hinzugefügt',
      benutzerId: autorId,
    },
  });

  return notiz;
}

export async function leadsNachStatus(kampagneId: string) {
  const kampagne = await prisma.kampagne.findUnique({
    where: { id: kampagneId },
    select: { pipelineSpalten: true },
  });

  if (!kampagne) {
    throw new AppFehler('Kampagne nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  const spalten = kampagne.pipelineSpalten as string[];

  const leads = await prisma.lead.findMany({
    where: { kampagneId, geloescht: false },
    include: {
      zugewiesener: { select: { id: true, vorname: true, nachname: true } },
      felddaten: {
        include: { feld: { select: { feldname: true } } },
      },
    },
    orderBy: { erstelltAm: 'desc' },
  });

  const pipeline: Record<string, typeof leads> = {};
  for (const spalte of spalten) {
    pipeline[spalte] = [];
  }

  for (const lead of leads) {
    const status = lead.status;
    if (pipeline[status]) {
      pipeline[status].push(lead);
    } else {
      // Falls Status nicht in Pipeline-Spalten → zu "Neu" hinzufügen
      if (pipeline['Neu']) {
        pipeline['Neu'].push(lead);
      }
    }
  }

  return { spalten, pipeline };
}
