import { describe, it, expect } from 'vitest';
import { piiInTextMaskieren, piiMaskieren } from './pii-scrubber';

describe('piiInTextMaskieren', () => {
  it('maskiert E-Mail-Adressen', () => {
    const text = 'Lead von max.mustermann@firma.de erhalten';
    expect(piiInTextMaskieren(text)).toContain('m***@f***.de');
    expect(piiInTextMaskieren(text)).not.toContain('mustermann');
    expect(piiInTextMaskieren(text)).not.toContain('firma.de');
  });

  it('maskiert deutsche Mobilnummern (+49-Format)', () => {
    const text = 'Telefon: +491761234567';
    const ergebnis = piiInTextMaskieren(text);
    expect(ergebnis).not.toContain('1761234567');
    expect(ergebnis).toMatch(/\+491\*\*\*/);
  });

  it('maskiert Telefonnummern mit Leerzeichen', () => {
    const text = 'Erreichbar unter 0176 1234567';
    const ergebnis = piiInTextMaskieren(text);
    expect(ergebnis).not.toContain('1234567');
  });

  it('maskiert mehrere PII im selben Text', () => {
    const text = 'Lead m@example.com mit Telefon +491761234567 angerufen';
    const ergebnis = piiInTextMaskieren(text);
    expect(ergebnis).not.toContain('m@example.com');
    expect(ergebnis).not.toContain('1761234567');
  });

  it('laesst nicht-PII unangetastet', () => {
    const text = 'Lead xyz-123 in Status "Anruf laeuft"';
    expect(piiInTextMaskieren(text)).toBe(text);
  });

  it('laesst UUIDs unangetastet', () => {
    const uuid = '5fe07655-08da-4f69-bf36-345baeca0be1';
    expect(piiInTextMaskieren(`Lead ${uuid}`)).toContain(uuid);
  });
});

describe('piiMaskieren', () => {
  it('maskiert PII rekursiv in Objekten', () => {
    const eingabe = { name: 'Max', email: 'max@firma.de', telefon: '+491761234567' };
    const ergebnis = piiMaskieren(eingabe) as Record<string, string>;
    expect(ergebnis.name).toBe('Max');
    expect(ergebnis.email).not.toContain('max@firma.de');
    expect(ergebnis.telefon).not.toContain('1761234567');
  });

  it('maskiert PII in verschachtelten Strukturen', () => {
    const eingabe = {
      lead: { kontakt: 'support@axano.com' },
      versuche: [{ telefon: '+491761234567' }],
    };
    const ergebnis = piiMaskieren(eingabe) as { lead: { kontakt: string }; versuche: { telefon: string }[] };
    expect(ergebnis.lead.kontakt).not.toContain('support@axano.com');
    expect(ergebnis.versuche[0].telefon).not.toContain('1761234567');
  });

  it('respektiert null und undefined', () => {
    expect(piiMaskieren(null)).toBe(null);
    expect(piiMaskieren(undefined)).toBe(undefined);
  });

  it('laesst Date-Objekte unangetastet', () => {
    const datum = new Date('2026-04-28T12:00:00Z');
    expect(piiMaskieren(datum)).toBe(datum);
  });

  it('maskiert PII in Error-Messages', () => {
    const fehler = new Error('Mail an test@firma.de fehlgeschlagen');
    const ergebnis = piiMaskieren(fehler) as { name: string; message: string };
    expect(ergebnis.name).toBe('Error');
    expect(ergebnis.message).not.toContain('test@firma.de');
  });
});
