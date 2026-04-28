/**
 * PII-Scrubber fuer Logs und Sentry-Events.
 * Maskiert E-Mail-Adressen und Telefonnummern, damit sie nicht in Logfiles
 * oder Monitoring-Services landen (DSGVO Art. 5 Abs. 1 lit. c — Datenminimierung).
 *
 * Bewusst konservativ: lieber zu viel maskieren als ungewollt PII durchlassen.
 * Lead-IDs (UUIDs) bleiben unangetastet, damit Logs noch korrelierbar sind.
 */

// E-Mail: weite, robuste Erkennung
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Telefonnummern: deutsche Mobil-/Festnetz-Formate inkl. internationaler Schreibweise
// Match: +491761234567, 01761234567, +49 176 1234567, 0049-176-12345678 etc.
// Mind. 7 zusammenhaengende Ziffern (mit optionalen Trennern), max 18, optional fuehrendes + oder 00
const TELEFON_PATTERN = /(?<![\w.])(?:\+|00)?\d[\d\s\-/()]{6,17}\d(?![\w.])/g;

/**
 * Maskiert eine E-Mail-Adresse fuer Logs: erstes Zeichen + erstes Domain-Zeichen sichtbar,
 * Rest mit *** ersetzt. Behaelt @ und Top-Level-Domain fuer Lesbarkeit.
 * Beispiel: max.mustermann@firma.de -> m***@f***.de
 */
function emailMaskieren(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '***';
  const lokal = email.slice(0, at);
  const domain = email.slice(at + 1);
  const punkt = domain.lastIndexOf('.');
  const tld = punkt > 0 ? domain.slice(punkt) : '';
  return `${lokal[0] || '*'}***@${domain[0] || '*'}***${tld}`;
}

/**
 * Maskiert eine Telefonnummer: Laendervorwahl + erste Ziffer sichtbar, Rest verdeckt.
 * Beispiel: +491761234567 -> +491***
 */
function telefonMaskieren(tel: string): string {
  // Aufraeumen: nur Ziffern + fuehrendes +
  const ziffern = tel.replace(/[^\d+]/g, '');
  if (ziffern.length < 4) return '***';
  // +49X*** oder 0X***
  return `${ziffern.slice(0, 4)}***`;
}

/**
 * Wendet beide Maskierungen auf einen String an.
 * Wenn der String kein PII enthaelt, bleibt er identisch.
 */
export function piiInTextMaskieren(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_PATTERN, (treffer) => emailMaskieren(treffer))
    .replace(TELEFON_PATTERN, (treffer) => telefonMaskieren(treffer));
}

/**
 * Maskiert PII rekursiv in einem beliebigen Wert (Object, Array, String, Primitive).
 * Wird vom Logger und von Sentry beforeSend genutzt.
 *
 * Vorsichtsmassnahmen:
 * - Nicht-Strings werden unveraendert weitergereicht
 * - Zirkulaere Strukturen werden nach max. 6 Ebenen abgebrochen
 * - Date/Buffer/Error-Objekte werden nicht traversiert
 */
export function piiMaskieren(wert: unknown, tiefe = 0): unknown {
  if (tiefe > 6) return wert;
  if (wert == null) return wert;
  if (typeof wert === 'string') return piiInTextMaskieren(wert);
  if (typeof wert !== 'object') return wert;
  if (wert instanceof Date) return wert;
  if (Buffer.isBuffer(wert)) return wert;
  if (wert instanceof Error) {
    return {
      name: wert.name,
      message: piiInTextMaskieren(wert.message),
      stack: wert.stack ? piiInTextMaskieren(wert.stack) : undefined,
    };
  }
  if (Array.isArray(wert)) {
    return wert.map((eintrag) => piiMaskieren(eintrag, tiefe + 1));
  }
  const ergebnis: Record<string, unknown> = {};
  for (const [schluessel, v] of Object.entries(wert as Record<string, unknown>)) {
    ergebnis[schluessel] = piiMaskieren(v, tiefe + 1);
  }
  return ergebnis;
}
