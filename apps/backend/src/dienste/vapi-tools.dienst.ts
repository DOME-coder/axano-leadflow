import { prisma } from '../datenbank/prisma.client';
import { socketServer } from '../websocket/socket.handler';
import { anrufQueue } from '../jobs/queue';
import { logger } from '../hilfsfunktionen/logger';

/**
 * Prüft Kalender-Verfügbarkeit um eine gewünschte Zeit.
 */
export async function kalenderPruefen(gewuenschteZeit: string): Promise<string> {
  const zeit = new Date(gewuenschteZeit);
  if (isNaN(zeit.getTime())) return 'Ich konnte die gewünschte Zeit leider nicht erkennen. Kannst du mir Tag und Uhrzeit nochmal nennen?';

  const tag = zeit.getDay();
  if (tag === 0 || tag === 6) {
    const montag = new Date(zeit);
    montag.setDate(montag.getDate() + (tag === 0 ? 1 : 2));
    const montagStr = montag.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    return `Am Wochenende bieten wir leider keine Termine an. Wie wäre es am ${montagStr}? Zu welcher Uhrzeit würde es dir passen?`;
  }

  const stunde = zeit.getHours();
  if (stunde < 8 || stunde >= 19) {
    return 'Unsere Termine sind zwischen 8 Uhr und 19 Uhr verfügbar. Welche Uhrzeit in diesem Zeitraum passt dir am besten?';
  }

  // 5 Slots um die gewünschte Zeit prüfen (gewünscht, ±30min, ±60min)
  const slotZeiten = [0, 30, -30, 60, -60].map((offset) => {
    const s = new Date(zeit);
    s.setMinutes(s.getMinutes() + offset);
    return s;
  }).filter((s) => s.getHours() >= 8 && s.getHours() < 19);

  // Bestehende Termine in diesem Zeitfenster laden
  const fensterStart = new Date(zeit);
  fensterStart.setHours(fensterStart.getHours() - 2);
  const fensterEnde = new Date(zeit);
  fensterEnde.setHours(fensterEnde.getHours() + 2);

  const bestehende = await prisma.termin.findMany({
    where: {
      beginnAm: { gte: fensterStart, lte: fensterEnde },
    },
    select: { beginnAm: true },
  });

  const belegteZeiten = bestehende.map((t) => t.beginnAm.getTime());

  // Freie Slots finden (30-Min-Fenster)
  const freieSlots = slotZeiten.filter((s) => {
    return !belegteZeiten.some((b) => Math.abs(b - s.getTime()) < 30 * 60 * 1000);
  });

  const zeitFormatieren = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    return m === 0 ? `${h} Uhr` : `${h} Uhr ${m}`;
  };

  const datumFormatieren = (d: Date) => {
    return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  if (freieSlots.length === 0) {
    return `Um die gewünschte Uhrzeit ist leider nichts mehr frei. Hast du einen anderen Tag oder eine andere Uhrzeit im Kopf?`;
  }

  // Prüfe ob der Wunschslot selbst frei ist
  const wunschFrei = freieSlots[0].getTime() === zeit.getTime();

  if (wunschFrei) {
    return `Am ${datumFormatieren(zeit)} um ${zeitFormatieren(zeit)} ist ein Termin frei. Soll ich den direkt für dich eintragen?`;
  }

  // Alternativen vorschlagen
  const alternativen = freieSlots.slice(0, 3).map((s) => zeitFormatieren(s)).join(', ');
  return `Um ${zeitFormatieren(zeit)} ist leider nichts frei. Wir hätten am ${datumFormatieren(freieSlots[0])} um ${alternativen} noch Slots frei – passt einer davon für dich?`;
}

/**
 * Bucht einen Termin für einen Lead.
 */
export async function terminBuchen(
  gewuenschteZeit: string,
  telefonnummer: string,
  vorname: string,
  nachname: string
): Promise<string> {
  const zeit = new Date(gewuenschteZeit);
  if (isNaN(zeit.getTime())) return 'Die gewünschte Zeit konnte nicht verarbeitet werden.';

  const lead = await prisma.lead.findFirst({
    where: { geloescht: false, telefon: { contains: telefonnummer.replace(/^\+49/, '').replace(/^0/, '') } },
    orderBy: { erstelltAm: 'desc' },
  });

  const endeAm = new Date(zeit);
  endeAm.setMinutes(endeAm.getMinutes() + 30);

  // Termin erstellen
  await prisma.termin.create({
    data: {
      leadId: lead?.id,
      kampagneId: lead?.kampagneId,
      titel: `Beratungstermin: ${vorname} ${nachname}`,
      beginnAm: zeit,
      endeAm,
      quelle: 'manuell',
    },
  });

  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'Termin gebucht' },
    });

    await prisma.leadStatusHistorie.create({
      data: {
        leadId: lead.id,
        alterStatus: lead.status,
        neuerStatus: 'Termin gebucht',
        grund: `Termin über KI-Telefonie gebucht`,
      },
    });

    await prisma.leadAktivitaet.create({
      data: {
        leadId: lead.id,
        typ: 'termin_gebucht',
        beschreibung: `Termin am ${zeit.toLocaleDateString('de-DE')} um ${zeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} gebucht (KI-Telefonie)`,
      },
    });

    const io = socketServer();
    if (io) {
      io.to(`kampagne:${lead.kampagneId}`).emit('lead:aktualisiert', {
        lead: { ...lead, status: 'Termin gebucht' },
      });
    }

    logger.info(`Termin gebucht: Lead ${lead.id} am ${zeit.toISOString()}`);
  }

  const datumStr = zeit.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const uhrzeitStr = zeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `Der Termin am ${datumStr} um ${uhrzeitStr} ist eingetragen. Du erhältst zeitnah eine Meetingeinladung per E-Mail mit einem Link zum Online-Meeting.`;
}

/**
 * Plant einen Rückruf zu einem gewünschten Zeitpunkt.
 */
export async function rueckrufPlanen(telefonnummer: string, rueckrufZeit: string): Promise<string> {
  const zeit = new Date(rueckrufZeit);
  if (isNaN(zeit.getTime())) return 'Die gewünschte Rückrufzeit konnte nicht verarbeitet werden.';

  const lead = await prisma.lead.findFirst({
    where: { geloescht: false, telefon: { contains: telefonnummer.replace(/^\+49/, '').replace(/^0/, '') } },
    orderBy: { erstelltAm: 'desc' },
  });

  if (!lead) {
    logger.warn(`Rückruf planen: Lead mit Telefon ${telefonnummer} nicht gefunden`);
    return 'Alles klar, ich notiere mir den Rückruf.';
  }

  // Lead-Status auf Follow-up setzen
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: 'Follow-up', naechsterAnrufAm: zeit },
  });

  // Letzten Versuch finden um die Versuchnummer zu bestimmen
  const letzterVersuch = await prisma.anrufVersuch.findFirst({
    where: { leadId: lead.id },
    orderBy: { versuchNummer: 'desc' },
    select: { versuchNummer: true },
  });

  const naechsteNummer = (letzterVersuch?.versuchNummer || 0) + 1;

  const versuch = await prisma.anrufVersuch.create({
    data: {
      leadId: lead.id,
      kampagneId: lead.kampagneId,
      versuchNummer: naechsteNummer,
      status: 'geplant',
      geplantFuer: zeit,
    },
  });

  const delay = Math.max(zeit.getTime() - Date.now(), 1000);
  await anrufQueue.add('anruf-durchfuehren', {
    anrufVersuchId: versuch.id,
    leadId: lead.id,
    kampagneId: lead.kampagneId,
  }, { delay, jobId: `anruf-rueckruf-${versuch.id}` });

  await prisma.leadAktivitaet.create({
    data: {
      leadId: lead.id,
      typ: 'anruf_gestartet',
      beschreibung: `Rückruf geplant für ${zeit.toLocaleDateString('de-DE')} um ${zeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
    },
  });

  logger.info(`Rückruf geplant: Lead ${lead.id} → ${zeit.toISOString()}`);

  const datumStr = zeit.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const uhrzeitStr = zeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `Alles klar, ich habe den Rückruf für ${datumStr} um ${uhrzeitStr} eingetragen.`;
}

/**
 * Korrigiert Lead-Daten während des Gesprächs.
 */
export async function leadDatenKorrigieren(
  telefonnummer: string,
  datenTyp: string,
  neuerWert: string
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { geloescht: false, telefon: { contains: telefonnummer.replace(/^\+49/, '').replace(/^0/, '') } },
    orderBy: { erstelltAm: 'desc' },
  });

  if (!lead) {
    logger.warn(`Lead-Korrektur: Lead mit Telefon ${telefonnummer} nicht gefunden`);
    return;
  }

  const feldMapping: Record<string, string> = {
    email: 'email',
    'e-mail': 'email',
    telefon: 'telefon',
    phone_number: 'telefon',
    vorname: 'vorname',
    first_name: 'vorname',
    nachname: 'nachname',
    last_name: 'nachname',
  };

  const dbFeld = feldMapping[datenTyp.toLowerCase()];

  if (dbFeld) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { [dbFeld]: neuerWert },
    });
  }

  await prisma.leadAktivitaet.create({
    data: {
      leadId: lead.id,
      typ: 'manuell',
      beschreibung: `Lead-Daten korrigiert: ${datenTyp} → ${neuerWert} (KI-Telefonie)`,
    },
  });

  logger.info(`Lead ${lead.id}: ${datenTyp} korrigiert → ${neuerWert}`);
}
