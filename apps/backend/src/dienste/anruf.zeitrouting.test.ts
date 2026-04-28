import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { naechsteAnrufzeitBerechnen } from './anruf.dienst';

// Setzt SystemTime auf eine Berlin-Zeit. Im November ist Berlin = UTC+1 (MEZ),
// im Juli = UTC+2 (MESZ). Wir testen mit November fuer eindeutige Verhaeltnisse.
function setzeBerlinZeit(jahr: number, monatEinsBasiert: number, tag: number, stunde: number, minute: number) {
  const utc = new Date(Date.UTC(jahr, monatEinsBasiert - 1, tag, stunde - 1, minute, 0));
  vi.setSystemTime(utc);
}

function berlinTeile(d: Date): { wochentag: number; stunde: number; minute: number; iso: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const teile = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const wochentagMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    wochentag: wochentagMap[teile.weekday] ?? -1,
    stunde: parseInt(teile.hour === '24' ? '0' : teile.hour, 10),
    minute: parseInt(teile.minute, 10),
    iso: `${teile.year}-${teile.month}-${teile.day} ${teile.hour}:${teile.minute}`,
  };
}

describe('naechsteAnrufzeitBerechnen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Zufallsverzoegerung deterministisch auf +0 Minuten setzen
    // (zufallsVerzoegerungAnwenden: floor(random * 20) - 10 → mit 0.5 ergibt das 0)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Freitag 22:00 → naechster Werktag (Montag) 09:00 (kein Samstag-Anruf)', () => {
    // Freitag, 7. November 2025, 22:00 Berlin
    setzeBerlinZeit(2025, 11, 7, 22, 0);
    const ergebnis = naechsteAnrufzeitBerechnen();
    const t = berlinTeile(ergebnis);
    expect(t.wochentag).toBe(1); // Montag
    expect(t.stunde).toBe(9);
    expect(t.minute).toBe(0);
  });

  it('Samstag 10:00 → Montag 09:00', () => {
    setzeBerlinZeit(2025, 11, 8, 10, 0);
    const ergebnis = naechsteAnrufzeitBerechnen();
    const t = berlinTeile(ergebnis);
    expect(t.wochentag).toBe(1);
    expect(t.stunde).toBe(9);
  });

  it('Sonntag 14:00 → Montag 09:00', () => {
    setzeBerlinZeit(2025, 11, 9, 14, 0);
    const ergebnis = naechsteAnrufzeitBerechnen();
    const t = berlinTeile(ergebnis);
    expect(t.wochentag).toBe(1);
    expect(t.stunde).toBe(9);
  });

  it('Mittwoch 08:00 → heute 09:00', () => {
    setzeBerlinZeit(2025, 11, 5, 8, 0);
    const ergebnis = naechsteAnrufzeitBerechnen();
    const t = berlinTeile(ergebnis);
    expect(t.wochentag).toBe(3); // Mittwoch
    expect(t.stunde).toBe(9);
    expect(t.minute).toBe(0);
  });

  it('Mittwoch 10:00 → naechster Slot 12:30 (heute)', () => {
    setzeBerlinZeit(2025, 11, 5, 10, 0);
    const ergebnis = naechsteAnrufzeitBerechnen();
    const t = berlinTeile(ergebnis);
    expect(t.wochentag).toBe(3);
    expect(t.stunde).toBe(12);
    expect(t.minute).toBe(30);
  });

  it('Donnerstag 19:30 → Freitag 09:00 (alle Slots heute durch)', () => {
    setzeBerlinZeit(2025, 11, 6, 19, 30);
    const ergebnis = naechsteAnrufzeitBerechnen();
    const t = berlinTeile(ergebnis);
    expect(t.wochentag).toBe(5); // Freitag
    expect(t.stunde).toBe(9);
  });

  it('Freitag 19:30 → Montag 09:00 (alle Slots durch + Wochenende uebersprungen)', () => {
    setzeBerlinZeit(2025, 11, 7, 19, 30);
    const ergebnis = naechsteAnrufzeitBerechnen();
    const t = berlinTeile(ergebnis);
    expect(t.wochentag).toBe(1); // Montag
    expect(t.stunde).toBe(9);
  });
});
