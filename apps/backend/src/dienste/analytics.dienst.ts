import { prisma } from '../datenbank/prisma.client';

function zeitraumBerechnen(zeitraum: string): Date {
  const jetzt = new Date();
  switch (zeitraum) {
    case 'heute':
      return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    case 'woche':
      return new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monat':
      return new Date(jetzt.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'quartal':
      return new Date(jetzt.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export async function plattformUebersicht(kundeId?: string) {
  const jetzt = new Date();
  const heuteStart = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  const wocheStart = new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monatStart = new Date(jetzt.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Kunden-Filter: Leads nur aus Kampagnen des Kunden
  const kampagneFilter = kundeId ? { kampagne: { kundeId } } : {};

  const [gesamtLeads, leadsHeute, leadsDieseWoche, leadsMonat, aktiveKampagnen, termineGebucht] = await Promise.all([
    prisma.lead.count({ where: { geloescht: false, ...kampagneFilter } }),
    prisma.lead.count({ where: { geloescht: false, erstelltAm: { gte: heuteStart }, ...kampagneFilter } }),
    prisma.lead.count({ where: { geloescht: false, erstelltAm: { gte: wocheStart }, ...kampagneFilter } }),
    prisma.lead.count({ where: { geloescht: false, erstelltAm: { gte: monatStart }, ...kampagneFilter } }),
    prisma.kampagne.count({ where: { status: 'aktiv', geloescht: false, ...(kundeId ? { kundeId } : {}) } }),
    prisma.lead.count({ where: { geloescht: false, status: 'Termin gebucht', ...kampagneFilter } }),
  ]);

  const conversionRateGesamt = gesamtLeads > 0
    ? Math.round((termineGebucht / gesamtLeads) * 1000) / 10
    : 0;

  return {
    gesamtLeads,
    leadsHeute,
    leadsDieseWoche,
    leadsMonat,
    aktiveKampagnen,
    conversionRateGesamt,
  };
}

export async function kampagnenAnalytics(kampagneId: string, zeitraum: string) {
  const vonDatum = zeitraumBerechnen(zeitraum);

  // Leads-Zeitreihe (pro Tag)
  const leads = await prisma.lead.findMany({
    where: {
      kampagneId,
      geloescht: false,
      erstelltAm: { gte: vonDatum },
    },
    select: { erstelltAm: true },
    orderBy: { erstelltAm: 'asc' },
  });

  const zeitreiheMap = new Map<string, number>();
  for (const lead of leads) {
    const datum = lead.erstelltAm.toISOString().split('T')[0];
    zeitreiheMap.set(datum, (zeitreiheMap.get(datum) || 0) + 1);
  }
  const leadsZeitreihe = Array.from(zeitreiheMap.entries()).map(([datum, anzahl]) => ({
    datum,
    anzahl,
  }));

  // Status-Verteilung
  const statusGruppen = await prisma.lead.groupBy({
    by: ['status'],
    where: { kampagneId, geloescht: false },
    _count: true,
  });
  const statusVerteilung: Record<string, number> = {};
  for (const gruppe of statusGruppen) {
    statusVerteilung[gruppe.status] = gruppe._count;
  }

  // Quellen-Aufschlüsselung
  const quellenGruppen = await prisma.lead.groupBy({
    by: ['quelle'],
    where: { kampagneId, geloescht: false },
    _count: true,
  });
  const quellenVerteilung: Record<string, number> = {};
  for (const gruppe of quellenGruppen) {
    quellenVerteilung[gruppe.quelle || 'unbekannt'] = gruppe._count;
  }

  // Automatisierungs-Report
  const [emailsGesendet, whatsappGesendet] = await Promise.all([
    prisma.leadAktivitaet.count({
      where: {
        lead: { kampagneId },
        typ: 'email_gesendet',
        erstelltAm: { gte: vonDatum },
      },
    }),
    prisma.leadAktivitaet.count({
      where: {
        lead: { kampagneId },
        typ: 'whatsapp_gesendet',
        erstelltAm: { gte: vonDatum },
      },
    }),
  ]);

  // Gesamt-KPIs
  const gesamtLeads = await prisma.lead.count({
    where: { kampagneId, geloescht: false },
  });
  const termineGebucht = statusVerteilung['Termin gebucht'] || 0;
  const conversionRate = gesamtLeads > 0
    ? Math.round((termineGebucht / gesamtLeads) * 1000) / 10
    : 0;

  return {
    leadsZeitreihe,
    statusVerteilung,
    quellenVerteilung,
    automatisierungen: { emailsGesendet, whatsappGesendet },
    gesamtLeads,
    conversionRate,
  };
}
