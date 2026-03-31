import { Prisma } from '@prisma/client';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { automatisierungsQueue } from '../jobs/queue';
import { logger } from '../hilfsfunktionen/logger';

interface AutomatisierungErstellen {
  name: string;
  beschreibung?: string;
  triggerTyp: 'lead_eingetroffen' | 'status_geaendert' | 'inaktivitaet' | 'zeitplan';
  triggerKonfiguration?: Prisma.InputJsonValue;
  bedingungen?: Prisma.InputJsonValue;
  schritte: Array<{
    reihenfolge: number;
    aktionTyp: 'email_senden' | 'whatsapp_senden' | 'status_setzen' | 'benachrichtigung' | 'warten' | 'warten_bis_uhrzeit';
    konfiguration?: Prisma.InputJsonValue;
  }>;
}

export async function automatisierungenAuflisten(kampagneId: string) {
  return prisma.automatisierung.findMany({
    where: { kampagneId },
    include: {
      schritte: { orderBy: { reihenfolge: 'asc' } },
      _count: { select: { ausfuehrungen: true } },
    },
    orderBy: { reihenfolge: 'asc' },
  });
}

export async function automatisierungErstellen(kampagneId: string, daten: AutomatisierungErstellen) {
  const kampagne = await prisma.kampagne.findUnique({ where: { id: kampagneId } });
  if (!kampagne) {
    throw new AppFehler('Kampagne nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  return prisma.automatisierung.create({
    data: {
      kampagneId,
      name: daten.name,
      beschreibung: daten.beschreibung,
      triggerTyp: daten.triggerTyp,
      triggerKonfiguration: daten.triggerKonfiguration ?? Prisma.JsonNull,
      bedingungen: daten.bedingungen ?? Prisma.JsonNull,
      schritte: {
        create: daten.schritte.map((s) => ({
          reihenfolge: s.reihenfolge,
          aktionTyp: s.aktionTyp,
          konfiguration: s.konfiguration ?? Prisma.JsonNull,
        })),
      },
    },
    include: {
      schritte: { orderBy: { reihenfolge: 'asc' } },
    },
  });
}

export async function automatisierungAktualisieren(
  id: string,
  daten: {
    name?: string;
    beschreibung?: string;
    aktiv?: boolean;
    triggerKonfiguration?: Prisma.InputJsonValue;
    bedingungen?: Prisma.InputJsonValue;
    schritte?: Array<{
      reihenfolge: number;
      aktionTyp: 'email_senden' | 'whatsapp_senden' | 'status_setzen' | 'benachrichtigung' | 'warten' | 'warten_bis_uhrzeit';
      konfiguration?: Prisma.InputJsonValue;
    }>;
  }
) {
  const updateData: Prisma.AutomatisierungUpdateInput = {};
  if (daten.name !== undefined) updateData.name = daten.name;
  if (daten.beschreibung !== undefined) updateData.beschreibung = daten.beschreibung;
  if (daten.aktiv !== undefined) updateData.aktiv = daten.aktiv;
  if (daten.triggerKonfiguration !== undefined) updateData.triggerKonfiguration = daten.triggerKonfiguration;
  if (daten.bedingungen !== undefined) updateData.bedingungen = daten.bedingungen;

  // Schritte komplett ersetzen wenn vorhanden
  if (daten.schritte) {
    await prisma.automatisierungsSchritt.deleteMany({ where: { automatisierungId: id } });
    await prisma.automatisierungsSchritt.createMany({
      data: daten.schritte.map((s) => ({
        automatisierungId: id,
        reihenfolge: s.reihenfolge,
        aktionTyp: s.aktionTyp,
        konfiguration: s.konfiguration ?? Prisma.JsonNull,
      })),
    });
  }

  return prisma.automatisierung.update({
    where: { id },
    data: updateData,
    include: {
      schritte: { orderBy: { reihenfolge: 'asc' } },
    },
  });
}

export async function automatisierungLoeschen(id: string) {
  return prisma.automatisierung.delete({ where: { id } });
}

/**
 * Startet die Ausführung einer Automatisierung für einen Lead.
 * Erstellt einen Ausführungseintrag und fügt einen Job in die Queue ein.
 */
export async function automatisierungAusfuehren(automatisierungId: string, leadId: string) {
  const ausfuehrung = await prisma.automatisierungsAusfuehrung.create({
    data: {
      automatisierungId,
      leadId,
      status: 'laeuft',
      aktuellerSchritt: 0,
    },
  });

  await automatisierungsQueue.add(
    'schritt-ausfuehren',
    {
      ausfuehrungId: ausfuehrung.id,
      automatisierungId,
      leadId,
      aktuellerSchritt: 0,
    },
    { jobId: `auto-${ausfuehrung.id}-0` }
  );

  logger.info(`Automatisierung gestartet: ${automatisierungId} für Lead ${leadId}`);
  return ausfuehrung;
}

/**
 * Sucht und startet alle aktiven Automatisierungen für einen Trigger.
 */
export async function automatisierungenAusloesen(
  kampagneId: string,
  triggerTyp: string,
  leadId: string,
  kontext?: { vonStatus?: string; zuStatus?: string }
) {
  const automatisierungen = await prisma.automatisierung.findMany({
    where: {
      kampagneId,
      triggerTyp: triggerTyp as 'lead_eingetroffen' | 'status_geaendert' | 'inaktivitaet' | 'zeitplan',
      aktiv: true,
    },
  });

  for (const auto of automatisierungen) {
    // Bei status_geaendert: vonStatus/zuStatus aus triggerKonfiguration prüfen
    if (triggerTyp === 'status_geaendert' && kontext) {
      const konfig = auto.triggerKonfiguration as Record<string, unknown> | null;
      const erwarteterVonStatus = konfig?.vonStatus as string | undefined;
      const erwarteterZuStatus = konfig?.zuStatus as string | undefined;

      if (erwarteterZuStatus && erwarteterZuStatus !== kontext.zuStatus) continue;
      if (erwarteterVonStatus && erwarteterVonStatus !== kontext.vonStatus) continue;
    }

    try {
      await automatisierungAusfuehren(auto.id, leadId);
    } catch (fehler) {
      logger.error(`Fehler beim Starten der Automatisierung ${auto.id}:`, { error: fehler });
    }
  }
}
