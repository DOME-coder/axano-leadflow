import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';

export async function promptVorlagenAuflisten(filter?: { branche?: string }) {
  const where = filter?.branche
    ? { branche: { contains: filter.branche, mode: 'insensitive' as const } }
    : {};

  return prisma.promptVorlage.findMany({
    where,
    orderBy: { aktualisiertAm: 'desc' },
  });
}

export async function promptVorlageErstellen(daten: {
  name: string;
  beschreibung?: string;
  branche: string;
  produkt?: string;
  vapiPrompt: string;
  erstelltVon?: string;
}) {
  return prisma.promptVorlage.create({ data: daten });
}

export async function promptVorlageAbrufen(id: string) {
  const vorlage = await prisma.promptVorlage.findUnique({ where: { id } });
  if (!vorlage) throw new AppFehler('Prompt-Vorlage nicht gefunden', 404, 'NICHT_GEFUNDEN');
  return vorlage;
}

export async function promptVorlageAktualisieren(id: string, daten: {
  name?: string;
  beschreibung?: string | null;
  branche?: string;
  produkt?: string | null;
  vapiPrompt?: string;
}) {
  return prisma.promptVorlage.update({
    where: { id },
    data: { ...daten, version: { increment: 1 } },
  });
}

export async function promptVorlageLoeschen(id: string) {
  return prisma.promptVorlage.delete({ where: { id } });
}

export async function aehnlicheVorlagenSuchen(branche: string) {
  // Suche nach Vorlagen mit ähnlicher Branche (case-insensitive contains)
  const suchbegriffe = branche.toLowerCase().split(/[\s,]+/).filter((s) => s.length > 2);

  if (suchbegriffe.length === 0) return [];

  return prisma.promptVorlage.findMany({
    where: {
      OR: suchbegriffe.map((begriff) => ({
        branche: { contains: begriff, mode: 'insensitive' as const },
      })),
    },
    orderBy: { aktualisiertAm: 'desc' },
    take: 5,
  });
}
