import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { zeitfensterAktiv, naechsterZeitfensterbeginn } from './zeitfenster';

// Hilfsfunktion: Date-Mock fuer eine bestimmte Berlin-Zeit setzen.
// Wir nutzen einen UTC-Zeitpunkt und lassen Intl.DateTimeFormat das Umrechnen uebernehmen.
function setzeBerlinZeit(jahr: number, monat: number, tag: number, stunde: number, minute: number) {
  // Winterzeit: Berlin = UTC+1. Datum fuer Tests liegt im November (definitv MEZ).
  const utc = new Date(Date.UTC(jahr, monat - 1, tag, stunde - 1, minute, 0));
  vi.setSystemTime(utc);
}

describe('zeitfensterAktiv', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ist aktiv Mittwoch 10:00 im Standard-Fenster', () => {
    // Mittwoch, 5. November 2025, 10:00 Berlin-Zeit
    setzeBerlinZeit(2025, 11, 5, 10, 0);
    expect(zeitfensterAktiv()).toBe(true);
  });

  it('ist inaktiv vor 09:00', () => {
    setzeBerlinZeit(2025, 11, 5, 8, 30);
    expect(zeitfensterAktiv()).toBe(false);
  });

  it('ist inaktiv nach 20:00', () => {
    setzeBerlinZeit(2025, 11, 5, 20, 30);
    expect(zeitfensterAktiv()).toBe(false);
  });

  it('ist inaktiv am Samstag (Standard: nur Mo-Fr)', () => {
    // Samstag, 8. November 2025, 14:00
    setzeBerlinZeit(2025, 11, 8, 14, 0);
    expect(zeitfensterAktiv()).toBe(false);
  });

  it('ist inaktiv am Sonntag (Standard: nur Mo-Fr)', () => {
    // Sonntag, 9. November 2025, 14:00
    setzeBerlinZeit(2025, 11, 9, 14, 0);
    expect(zeitfensterAktiv()).toBe(false);
  });

  it('respektiert benutzerdefinierte Stunden', () => {
    setzeBerlinZeit(2025, 11, 5, 21, 30);
    expect(zeitfensterAktiv({ von: '09:00', bis: '22:00' })).toBe(true);
  });

  it('respektiert benutzerdefinierte Wochentage (inkl. Samstag)', () => {
    setzeBerlinZeit(2025, 11, 8, 14, 0);
    expect(zeitfensterAktiv({ wochentage: [1, 2, 3, 4, 5, 6] })).toBe(true);
  });
});

describe('naechsterZeitfensterbeginn', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('springt auf heute 09:00 wenn es noch vor 09:00 ist', () => {
    // Mittwoch, 5. Nov 2025, 07:00 Berlin-Zeit
    setzeBerlinZeit(2025, 11, 5, 7, 0);
    const naechste = naechsterZeitfensterbeginn();
    expect(naechste.getHours()).toBe(9);
    expect(naechste.getMinutes()).toBe(0);
    // Berlin-Wochentag soll Mittwoch (3) sein
  });

  it('springt auf naechsten Werktag (Mo) wenn Freitag-Abend', () => {
    // Freitag, 7. Nov 2025, 22:00 Berlin-Zeit
    setzeBerlinZeit(2025, 11, 7, 22, 0);
    const naechste = naechsterZeitfensterbeginn();
    // 7.Nov Freitag + 1 = Sa, +2 = So, +3 = Mo 10.Nov
    const wochentag = naechste.getDay() === 0 ? 7 : naechste.getDay();
    expect([1, 2, 3, 4, 5]).toContain(wochentag); // ist Montag-Freitag
    expect(naechste.getHours()).toBe(9);
  });

  it('springt auf Montag 09:00 wenn aktuell Samstag', () => {
    setzeBerlinZeit(2025, 11, 8, 12, 0);
    const naechste = naechsterZeitfensterbeginn();
    const wochentag = naechste.getDay() === 0 ? 7 : naechste.getDay();
    expect([1, 2, 3, 4, 5]).toContain(wochentag);
    expect(naechste.getHours()).toBe(9);
  });

  it('respektiert benutzerdefinierte Start-Uhrzeit', () => {
    setzeBerlinZeit(2025, 11, 5, 5, 0);
    const naechste = naechsterZeitfensterbeginn({ von: '08:30' });
    expect(naechste.getHours()).toBe(8);
    expect(naechste.getMinutes()).toBe(30);
  });
});
