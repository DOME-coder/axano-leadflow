import { describe, it, expect, beforeAll } from 'vitest';
import { verschluesseln, entschluesseln, konfigurationVerschluesseln, konfigurationEntschluesseln } from './verschluesselung';

beforeAll(() => {
  process.env.VERSCHLUESSELUNGS_SCHLUESSEL = 'test-geheimnis-nur-fuer-tests-mindestens-32-zeichen';
});

describe('verschluesseln / entschluesseln', () => {
  it('ver- und entschluesselt einen einfachen Text wieder', () => {
    const original = 'geheimer-api-schluessel-123';
    const verschluesselt = verschluesseln(original);
    expect(verschluesselt).not.toBe(original);
    expect(entschluesseln(verschluesselt)).toBe(original);
  });

  it('liefert bei gleichen Eingaben unterschiedliche Chiffrate (zufaelliger IV)', () => {
    const original = 'same-input';
    const a = verschluesseln(original);
    const b = verschluesseln(original);
    expect(a).not.toBe(b);
    expect(entschluesseln(a)).toBe(original);
    expect(entschluesseln(b)).toBe(original);
  });

  it('nutzt das Format iv:authTag:daten (hex)', () => {
    const verschluesselt = verschluesseln('test');
    const teile = verschluesselt.split(':');
    expect(teile).toHaveLength(3);
    teile.forEach((teil) => expect(teil).toMatch(/^[0-9a-f]+$/));
  });

  it('wirft bei ungueltigem Format', () => {
    expect(() => entschluesseln('nicht-valide')).toThrow();
  });

  it('schuetzt gegen Manipulation (authTag)', () => {
    const verschluesselt = verschluesseln('originaltext');
    // Daten-Teil manipulieren
    const [iv, authTag, daten] = verschluesselt.split(':');
    const manipuliertesDatenHex = daten.split('').reverse().join('');
    const manipuliert = `${iv}:${authTag}:${manipuliertesDatenHex}`;
    expect(() => entschluesseln(manipuliert)).toThrow();
  });

  it('funktioniert mit UTF-8 Umlauten', () => {
    const original = 'Tür öffnen – schließen!';
    expect(entschluesseln(verschluesseln(original))).toBe(original);
  });
});

describe('konfigurationVerschluesseln / konfigurationEntschluesseln', () => {
  it('verarbeitet Konfigurations-Objekt rundum', () => {
    const konfig = { api_schluessel: 'abc123', host: 'smtp.example.com' };
    const verschluesselt = konfigurationVerschluesseln(konfig);
    expect(verschluesselt.api_schluessel).not.toBe(konfig.api_schluessel);
    expect(konfigurationEntschluesseln(verschluesselt)).toEqual(konfig);
  });

  it('behaelt leere Werte als leeren String', () => {
    const konfig = { key: '', other: 'value' };
    const verschluesselt = konfigurationVerschluesseln(konfig);
    expect(verschluesselt.key).toBe('');
    expect(konfigurationEntschluesseln(verschluesselt).key).toBe('');
  });

  it('gibt Original zurueck wenn Wert nicht verschluesselt ist', () => {
    // Simuliert Legacy-Daten aus einer Zeit vor Verschluesselung
    const ergebnis = konfigurationEntschluesseln({ klartext: 'nicht-verschluesselt' });
    expect(ergebnis.klartext).toBe('nicht-verschluesselt');
  });
});
