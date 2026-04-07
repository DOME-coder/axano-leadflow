import { Prisma } from '@prisma/client';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';
import crypto from 'crypto';

interface KampagneErstellen {
  name: string;
  beschreibung?: string;
  triggerTyp: 'facebook_lead_ads' | 'webhook' | 'email' | 'whatsapp' | 'webformular';
  triggerKonfiguration?: Prisma.InputJsonValue;
  pipelineSpalten?: string[];
  vapiAktiviert?: boolean;
  vapiAssistantId?: string | null;
  vapiPhoneNumberId?: string | null;
  vapiPrompt?: string | null;
  vapiErsteBotschaft?: string | null;
  vapiVoicemailNachricht?: string | null;
  maxAnrufVersuche?: number;
  anrufZeitslots?: Prisma.InputJsonValue;
  emailAktiviert?: boolean;
  whatsappAktiviert?: boolean;
  benachrichtigungEmail?: string | null;
  calendlyLink?: string | null;
  branche?: string | null;
  produkt?: string | null;
  zielgruppe?: string | null;
  ton?: string | null;
  kiName?: string | null;
  kiGeschlecht?: string | null;
  kiSprachstil?: string | null;
  emailTemplateVerpasst?: string | null;
  emailTemplateVoicemail?: string | null;
  emailTemplateUnerreichbar?: string | null;
  whatsappTemplateVerpasst?: string | null;
  whatsappTemplateUnerreichbar?: string | null;
  whatsappTemplateNichtInteressiert?: string | null;
  whatsappKanalId?: string | null;
  kundeId?: string | null;
  erstelltVon?: string;
  felder?: Array<{
    feldname: string;
    bezeichnung: string;
    feldtyp: 'text' | 'zahl' | 'email' | 'telefon' | 'datum' | 'auswahl' | 'ja_nein' | 'mehrzeilig';
    pflichtfeld?: boolean;
    optionen?: Prisma.InputJsonValue;
    reihenfolge?: number;
    platzhalter?: string;
    hilfetext?: string;
  }>;
}

function webhookSlugErstellen(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c] || c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const zufall = crypto.randomBytes(4).toString('hex');
  return `${slug}-${zufall}`;
}

export async function kampagnenAuflisten(filter: {
  status?: string;
  kundeId?: string;
  seite?: number;
  proSeite?: number;
}) {
  const seite = filter.seite || 1;
  const proSeite = filter.proSeite || 20;
  const skip = (seite - 1) * proSeite;

  const where: Prisma.KampagneWhereInput = { geloescht: false };
  if (filter.status) {
    where.status = filter.status as 'aktiv' | 'pausiert' | 'archiviert';
  }
  if (filter.kundeId) {
    where.kundeId = filter.kundeId;
  }

  const [eintraege, gesamt] = await Promise.all([
    prisma.kampagne.findMany({
      where,
      include: {
        _count: { select: { leads: true } },
        felder: { orderBy: { reihenfolge: 'asc' } },
      },
      orderBy: { erstelltAm: 'desc' },
      skip,
      take: proSeite,
    }),
    prisma.kampagne.count({ where }),
  ]);

  const kampagnenMitStats = await Promise.all(
    eintraege.map(async (k) => {
      const leadsHeute = await prisma.lead.count({
        where: {
          kampagneId: k.id,
          geloescht: false,
          erstelltAm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      });

      const termineGebucht = await prisma.lead.count({
        where: {
          kampagneId: k.id,
          geloescht: false,
          status: 'Termin gebucht',
        },
      });

      const gesamtLeads = k._count.leads;
      const conversionRate = gesamtLeads > 0
        ? Math.round((termineGebucht / gesamtLeads) * 1000) / 10
        : 0;

      return {
        id: k.id,
        name: k.name,
        beschreibung: k.beschreibung,
        status: k.status,
        triggerTyp: k.triggerTyp,
        webhookSlug: k.webhookSlug,
        pipelineSpalten: k.pipelineSpalten,
        erstelltAm: k.erstelltAm,
        aktualisiertAm: k.aktualisiertAm,
        felder: k.felder,
        statistiken: {
          gesamtLeads,
          leadsHeute,
          conversionRate,
        },
      };
    })
  );

  return { eintraege: kampagnenMitStats, gesamt, seite, proSeite };
}

export async function kampagneErstellen(daten: KampagneErstellen) {
  const webhookSlug = webhookSlugErstellen(daten.name);

  const kampagne = await prisma.kampagne.create({
    data: {
      name: daten.name,
      beschreibung: daten.beschreibung,
      triggerTyp: daten.triggerTyp,
      triggerKonfiguration: daten.triggerKonfiguration ?? Prisma.JsonNull,
      pipelineSpalten: daten.pipelineSpalten ?? [
        'Neu', 'Anruf läuft', 'Voicemail', 'Follow-up',
        'Nicht erreichbar', 'Falsche Nummer', 'Nicht interessiert', 'Termin gebucht',
      ],
      webhookSlug,
      vapiAktiviert: daten.vapiAktiviert,
      vapiAssistantId: daten.vapiAssistantId,
      vapiPhoneNumberId: daten.vapiPhoneNumberId,
      vapiPrompt: daten.vapiPrompt,
      vapiErsteBotschaft: daten.vapiErsteBotschaft,
      vapiVoicemailNachricht: daten.vapiVoicemailNachricht,
      maxAnrufVersuche: daten.maxAnrufVersuche,
      anrufZeitslots: daten.anrufZeitslots ?? undefined,
      emailAktiviert: daten.emailAktiviert,
      whatsappAktiviert: daten.whatsappAktiviert,
      benachrichtigungEmail: daten.benachrichtigungEmail,
      calendlyLink: daten.calendlyLink,
      branche: daten.branche,
      produkt: daten.produkt,
      zielgruppe: daten.zielgruppe,
      ton: daten.ton,
      kiName: daten.kiName,
      kiGeschlecht: daten.kiGeschlecht,
      kiSprachstil: daten.kiSprachstil,
      emailTemplateVerpasst: daten.emailTemplateVerpasst,
      emailTemplateVoicemail: daten.emailTemplateVoicemail,
      emailTemplateUnerreichbar: daten.emailTemplateUnerreichbar,
      whatsappTemplateVerpasst: daten.whatsappTemplateVerpasst,
      whatsappTemplateUnerreichbar: daten.whatsappTemplateUnerreichbar,
      whatsappTemplateNichtInteressiert: daten.whatsappTemplateNichtInteressiert,
      whatsappKanalId: daten.whatsappKanalId,
      kundeId: daten.kundeId,
      erstelltVon: daten.erstelltVon,
      felder: daten.felder
        ? {
            create: daten.felder.map((f, index) => ({
              feldname: f.feldname,
              bezeichnung: f.bezeichnung,
              feldtyp: f.feldtyp,
              pflichtfeld: f.pflichtfeld || false,
              optionen: f.optionen ?? undefined,
              reihenfolge: f.reihenfolge ?? index,
              platzhalter: f.platzhalter,
              hilfetext: f.hilfetext,
            })),
          }
        : undefined,
    },
    include: {
      felder: { orderBy: { reihenfolge: 'asc' } },
    },
  });

  return kampagne;
}

export async function kampagneAbrufen(id: string) {
  const kampagne = await prisma.kampagne.findUnique({
    where: { id },
    include: {
      felder: { orderBy: { reihenfolge: 'asc' } },
      ersteller: {
        select: { id: true, vorname: true, nachname: true },
      },
      kunde: {
        select: { id: true, name: true },
      },
      _count: { select: { leads: true, automatisierungen: true } },
    },
  });

  if (!kampagne) {
    throw new AppFehler('Kampagne nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  return kampagne;
}

export async function kampagneAktualisieren(
  id: string,
  daten: {
    name?: string;
    beschreibung?: string;
    status?: 'aktiv' | 'pausiert' | 'archiviert';
    triggerKonfiguration?: Prisma.InputJsonValue;
    pipelineSpalten?: string[];
    vapiAktiviert?: boolean;
    vapiAssistantId?: string | null;
    vapiPhoneNumberId?: string | null;
    vapiPrompt?: string | null;
    maxAnrufVersuche?: number;
    anrufZeitslots?: Prisma.InputJsonValue;
    emailAktiviert?: boolean;
    whatsappAktiviert?: boolean;
    benachrichtigungEmail?: string | null;
    calendlyLink?: string | null;
    branche?: string | null;
    produkt?: string | null;
    zielgruppe?: string | null;
    ton?: string | null;
    kiName?: string | null;
    kiGeschlecht?: string | null;
    kiSprachstil?: string | null;
    emailTemplateVerpasst?: string | null;
    emailTemplateVoicemail?: string | null;
    emailTemplateUnerreichbar?: string | null;
    whatsappTemplateVerpasst?: string | null;
    whatsappTemplateUnerreichbar?: string | null;
    whatsappKanalId?: string | null;
    kundeId?: string | null;
  }
) {
  const updateData: Prisma.KampagneUpdateInput = {};
  if (daten.name !== undefined) updateData.name = daten.name;
  if (daten.beschreibung !== undefined) updateData.beschreibung = daten.beschreibung;
  if (daten.status !== undefined) updateData.status = daten.status;
  if (daten.triggerKonfiguration !== undefined) updateData.triggerKonfiguration = daten.triggerKonfiguration;
  if (daten.pipelineSpalten !== undefined) updateData.pipelineSpalten = daten.pipelineSpalten;
  if (daten.vapiAktiviert !== undefined) updateData.vapiAktiviert = daten.vapiAktiviert;
  if (daten.vapiAssistantId !== undefined) updateData.vapiAssistantId = daten.vapiAssistantId;
  if (daten.vapiPhoneNumberId !== undefined) updateData.vapiPhoneNumberId = daten.vapiPhoneNumberId;
  if (daten.vapiPrompt !== undefined) updateData.vapiPrompt = daten.vapiPrompt;
  if (daten.maxAnrufVersuche !== undefined) updateData.maxAnrufVersuche = daten.maxAnrufVersuche;
  if (daten.anrufZeitslots !== undefined) updateData.anrufZeitslots = daten.anrufZeitslots;
  if (daten.emailAktiviert !== undefined) updateData.emailAktiviert = daten.emailAktiviert;
  if (daten.whatsappAktiviert !== undefined) updateData.whatsappAktiviert = daten.whatsappAktiviert;
  if (daten.benachrichtigungEmail !== undefined) updateData.benachrichtigungEmail = daten.benachrichtigungEmail || null;
  if (daten.calendlyLink !== undefined) updateData.calendlyLink = daten.calendlyLink || null;
  if (daten.branche !== undefined) updateData.branche = daten.branche;
  if (daten.produkt !== undefined) updateData.produkt = daten.produkt;
  if (daten.zielgruppe !== undefined) updateData.zielgruppe = daten.zielgruppe;
  if (daten.ton !== undefined) updateData.ton = daten.ton;
  if (daten.kiName !== undefined) updateData.kiName = daten.kiName;
  if (daten.kiGeschlecht !== undefined) updateData.kiGeschlecht = daten.kiGeschlecht;
  if (daten.kiSprachstil !== undefined) updateData.kiSprachstil = daten.kiSprachstil;
  if (daten.emailTemplateVerpasst !== undefined) updateData.emailTemplateVerpasst = daten.emailTemplateVerpasst;
  if (daten.emailTemplateVoicemail !== undefined) updateData.emailTemplateVoicemail = daten.emailTemplateVoicemail;
  if (daten.emailTemplateUnerreichbar !== undefined) updateData.emailTemplateUnerreichbar = daten.emailTemplateUnerreichbar;
  if (daten.whatsappTemplateVerpasst !== undefined) updateData.whatsappTemplateVerpasst = daten.whatsappTemplateVerpasst;
  if (daten.whatsappTemplateUnerreichbar !== undefined) updateData.whatsappTemplateUnerreichbar = daten.whatsappTemplateUnerreichbar;
  if (daten.whatsappKanalId !== undefined) updateData.whatsappKanalId = daten.whatsappKanalId;
  if (daten.kundeId !== undefined) {
    if (daten.kundeId) {
      updateData.kunde = { connect: { id: daten.kundeId } };
    } else {
      updateData.kunde = { disconnect: true };
    }
  }

  const kampagne = await prisma.kampagne.update({
    where: { id },
    data: updateData,
    include: {
      felder: { orderBy: { reihenfolge: 'asc' } },
    },
  });

  return kampagne;
}

export async function kampagneDuplizieren(id: string, erstelltVon: string) {
  const original = await prisma.kampagne.findUnique({
    where: { id },
    include: {
      felder: true,
      automatisierungen: { include: { schritte: true } },
    },
  });

  if (!original) {
    throw new AppFehler('Kampagne nicht gefunden', 404, 'NICHT_GEFUNDEN');
  }

  const neueKampagne = await prisma.kampagne.create({
    data: {
      name: `${original.name} (Kopie)`,
      beschreibung: original.beschreibung,
      triggerTyp: original.triggerTyp,
      triggerKonfiguration: original.triggerKonfiguration ?? Prisma.JsonNull,
      pipelineSpalten: original.pipelineSpalten ?? Prisma.JsonNull,
      webhookSlug: webhookSlugErstellen(original.name),
      erstelltVon,
      felder: {
        create: original.felder.map((f) => ({
          feldname: f.feldname,
          bezeichnung: f.bezeichnung,
          feldtyp: f.feldtyp,
          pflichtfeld: f.pflichtfeld,
          optionen: f.optionen ?? undefined,
          reihenfolge: f.reihenfolge,
          platzhalter: f.platzhalter,
          hilfetext: f.hilfetext,
        })),
      },
      automatisierungen: {
        create: original.automatisierungen.map((a) => ({
          name: a.name,
          beschreibung: a.beschreibung,
          aktiv: a.aktiv,
          triggerTyp: a.triggerTyp,
          triggerKonfiguration: a.triggerKonfiguration ?? Prisma.JsonNull,
          bedingungen: a.bedingungen ?? Prisma.JsonNull,
          reihenfolge: a.reihenfolge,
          schritte: {
            create: a.schritte.map((s) => ({
              reihenfolge: s.reihenfolge,
              aktionTyp: s.aktionTyp,
              konfiguration: s.konfiguration ?? Prisma.JsonNull,
            })),
          },
        })),
      },
    },
    include: {
      felder: { orderBy: { reihenfolge: 'asc' } },
    },
  });

  return neueKampagne;
}
