import { describe, it, expect } from 'vitest';
import { telefonNormalisieren, istHandynummer } from './telefon.formatierung';

describe('telefonNormalisieren', () => {
  it('konvertiert fuehrende 0 zu +49', () => {
    expect(telefonNormalisieren('0171 1234567')).toBe('+491711234567');
  });

  it('konvertiert 0049 zu +49', () => {
    expect(telefonNormalisieren('00491711234567')).toBe('+491711234567');
  });

  it('korrigiert +490 zu +49', () => {
    expect(telefonNormalisieren('+4901711234567')).toBe('+491711234567');
  });

  it('fuegt + vor 49 ein', () => {
    expect(telefonNormalisieren('491711234567')).toBe('+491711234567');
  });

  it('behaelt bereits korrekt formatierte Nummern bei', () => {
    expect(telefonNormalisieren('+491711234567')).toBe('+491711234567');
  });

  it('entfernt Leerzeichen, Bindestriche, Klammern, Punkte und Schraegstriche', () => {
    expect(telefonNormalisieren('0171 / 123-45.67 (xyz)')).toBe('+491711234567xyz');
  });

  it('gibt null fuer leere Eingabe zurueck', () => {
    expect(telefonNormalisieren('')).toBeNull();
    expect(telefonNormalisieren(null)).toBeNull();
    expect(telefonNormalisieren(undefined)).toBeNull();
  });

  it('gibt null fuer reine Whitespace-Eingabe zurueck', () => {
    expect(telefonNormalisieren('   ')).toBeNull();
  });

  it('konvertiert Festnetz-Nummer mit Vorwahl', () => {
    expect(telefonNormalisieren('030 12345678')).toBe('+493012345678');
  });
});

describe('istHandynummer', () => {
  it.each([
    ['+491711234567', true],
    ['+491521234567', true],
    ['+491761234567', true],
    ['0171 1234567', true],
    ['0049 160 1234567', true],
  ])('erkennt Mobilnummer %s → %s', (nummer, erwartet) => {
    expect(istHandynummer(nummer)).toBe(erwartet);
  });

  it.each([
    ['+493012345678', false],    // Berlin Festnetz
    ['+494012345678', false],    // Hamburg Festnetz
    ['+498912345678', false],    // Muenchen Festnetz
    ['030 12345678', false],
  ])('erkennt Festnetz-Nummer %s → %s', (nummer, erwartet) => {
    expect(istHandynummer(nummer)).toBe(erwartet);
  });

  it('gibt false zurueck fuer leere Eingabe', () => {
    expect(istHandynummer('')).toBe(false);
  });

  it('gibt false zurueck fuer ungueltige Eingabe', () => {
    expect(istHandynummer('abc')).toBe(false);
  });
});
