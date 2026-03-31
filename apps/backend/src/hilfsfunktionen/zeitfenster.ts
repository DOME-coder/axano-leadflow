interface ZeitfensterKonfiguration {
  von?: string;   // z.B. "09:00"
  bis?: string;   // z.B. "20:00"
  wochentage?: number[]; // 1=Montag, 7=Sonntag
}

const STANDARD_ZEITFENSTER: ZeitfensterKonfiguration = {
  von: '09:00',
  bis: '20:00',
  wochentage: [1, 2, 3, 4, 5], // Mo-Fr
};

/**
 * Prüft ob die aktuelle Zeit innerhalb des konfigurierten Zeitfensters liegt.
 */
export function zeitfensterAktiv(konfig?: ZeitfensterKonfiguration): boolean {
  const fenster = { ...STANDARD_ZEITFENSTER, ...konfig };
  const jetzt = berlinZeit();

  // Wochentag prüfen (getDay: 0=So, 1=Mo ... 6=Sa → umwandeln in 1=Mo, 7=So)
  const wochentag = jetzt.getDay() === 0 ? 7 : jetzt.getDay();
  if (fenster.wochentage && !fenster.wochentage.includes(wochentag)) {
    return false;
  }

  // Uhrzeit prüfen
  const aktuelleMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
  const vonMinuten = uhrzeitZuMinuten(fenster.von || '09:00');
  const bisMinuten = uhrzeitZuMinuten(fenster.bis || '20:00');

  return aktuelleMinuten >= vonMinuten && aktuelleMinuten < bisMinuten;
}

/**
 * Berechnet den nächsten Zeitpunkt, an dem das Zeitfenster aktiv ist.
 */
export function naechsterZeitfensterbeginn(konfig?: ZeitfensterKonfiguration): Date {
  const fenster = { ...STANDARD_ZEITFENSTER, ...konfig };
  const jetzt = berlinZeit();
  const [stunden, minuten] = (fenster.von || '09:00').split(':').map(Number);

  const ziel = new Date(jetzt);
  ziel.setHours(stunden, minuten, 0, 0);

  // Falls Zeitpunkt heute schon vorbei ist, morgen versuchen
  if (ziel <= jetzt) {
    ziel.setDate(ziel.getDate() + 1);
  }

  // Nächsten gültigen Wochentag finden
  if (fenster.wochentage && fenster.wochentage.length > 0) {
    let versuche = 0;
    while (versuche < 8) {
      const wochentag = ziel.getDay() === 0 ? 7 : ziel.getDay();
      if (fenster.wochentage.includes(wochentag)) break;
      ziel.setDate(ziel.getDate() + 1);
      versuche++;
    }
  }

  return ziel;
}

function uhrzeitZuMinuten(uhrzeit: string): number {
  const [stunden, minuten] = uhrzeit.split(':').map(Number);
  return stunden * 60 + minuten;
}

function berlinZeit(): Date {
  const optionen: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const berlinStr = new Intl.DateTimeFormat('de-DE', optionen).format(new Date());
  const [datumTeil, zeitTeil] = berlinStr.split(', ');
  const [tag, monat, jahr] = datumTeil.split('.');
  const [stunden, minuten, sekunden] = zeitTeil.split(':');
  return new Date(
    parseInt(jahr), parseInt(monat) - 1, parseInt(tag),
    parseInt(stunden), parseInt(minuten), parseInt(sekunden)
  );
}
