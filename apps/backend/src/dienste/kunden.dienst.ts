import { Prisma } from '@prisma/client';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';

export async function kundenAuflisten(filter: {
  suche?: string;
  seite?: number;
  proSeite?: number;
}) {
  const seite = filter.seite || 1;
  const proSeite = filter.proSeite || 20;
  const skip = (seite - 1) * proSeite;

  const where: Prisma.KundeWhereInput = {};
  if (filter.suche) {
    where.OR = [
      { name: { contains: filter.suche, mode: 'insensitive' } },
      { kontaktperson: { contains: filter.suche, mode: 'insensitive' } },
      { email: { contains: filter.suche, mode: 'insensitive' } },
    ];
  }

  const [eintraege, gesamt] = await Promise.all([
    prisma.kunde.findMany({
      where,
      include: {
        _count: { select: { kampagnen: true } },
      },
      orderBy: { erstelltAm: 'desc' },
      skip,
      take: proSeite,
    }),
    prisma.kunde.count({ where }),
  ]);

  const kundenMitStats = await Promise.all(
    eintraege.map(async (k) => {
      const gesamtLeads = await prisma.lead.count({
        where: { kampagne: { kundeId: k.id }, geloescht: false },
      });

      const termineGebucht = await prisma.lead.count({
        where: { kampagne: { kundeId: k.id }, geloescht: false, status: 'Termin gebucht' },
      });

      const conversionRate = gesamtLeads > 0
        ? Math.round((termineGebucht / gesamtLeads) * 1000) / 10
        : 0;

      return {
        id: k.id,
        name: k.name,
        kontaktperson: k.kontaktperson,
        email: k.email,
        telefon: k.telefon,
        branche: k.branche,
        notizen: k.notizen,
        erstelltAm: k.erstelltAm,
        statistiken: {
          kampagnenAnzahl: k._count.kampagnen,
          gesamtLeads,
          conversionRate,
        },
      };
    })
  );

  return { eintraege: kundenMitStats, gesamt, seite, proSeite };
}

export async function kundeErstellen(daten: {
  name: string;
  kontaktperson?: string;
  email?: string;
  telefon?: string;
  branche?: string;
  notizen?: string;
  erstelltVon?: string;
}) {
  return prisma.kunde.create({
    data: {
      name: daten.name,
      kontaktperson: daten.kontaktperson,
      email: daten.email,
      telefon: daten.telefon,
      branche: daten.branche,
      notizen: daten.notizen,
      erstelltVon: daten.erstelltVon,
    },
  });
}

export async function kundeAbrufen(id: string) {
  const kunde = await prisma.kunde.findUnique({
    where: { id },
    include: {
      kampagnen: {
        include: {
          _count: { select: { leads: true } },
        },
        orderBy: { erstelltAm: 'desc' },
      },
    },
  });

  if (!kunde) {
    throw new AppFehler('Kunde nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  const gesamtLeads = await prisma.lead.count({
    where: { kampagne: { kundeId: id }, geloescht: false },
  });

  const termineGebucht = await prisma.lead.count({
    where: { kampagne: { kundeId: id }, geloescht: false, status: 'Termin gebucht' },
  });

  const conversionRate = gesamtLeads > 0
    ? Math.round((termineGebucht / gesamtLeads) * 1000) / 10
    : 0;

  return {
    ...kunde,
    statistiken: {
      kampagnenAnzahl: kunde.kampagnen.length,
      gesamtLeads,
      conversionRate,
    },
  };
}

export async function kundeAktualisieren(id: string, daten: {
  name?: string;
  kontaktperson?: string | null;
  email?: string | null;
  telefon?: string | null;
  branche?: string | null;
  notizen?: string | null;
}) {
  return prisma.kunde.update({
    where: { id },
    data: daten,
  });
}

export async function kundeLoeschen(id: string) {
  const kampagnenAnzahl = await prisma.kampagne.count({ where: { kundeId: id } });
  if (kampagnenAnzahl > 0) {
    throw new AppFehler(
      `Kunde hat noch ${kampagnenAnzahl} zugeordnete Kampagne(n). Bitte zuerst die Zuordnung entfernen.`,
      400,
      'KUNDE_HAT_KAMPAGNEN'
    );
  }

  return prisma.kunde.delete({ where: { id } });
}
