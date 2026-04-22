/**
 * Wandelt eine E-Mail-Adresse in eine aussprechbare Form um.
 *
 * Beispiel:
 *   emailZumVorlesen('max.mustermann@allianz.de')
 *   → 'max Punkt mustermann Ätt allianz Punkt de'
 *
 * Sonderzeichen werden durch ausgeschriebene deutsche Woerter ersetzt,
 * getrennt durch Leerzeichen. Die KI im Voice-Call bekommt diese Form
 * direkt und liest sie wortwoertlich vor — kein Raum fuer Fehlinterpretation.
 */

const ZEICHEN_MAPPING: Record<string, string> = {
  '@': 'Ätt',
  '.': 'Punkt',
  '-': 'Bindestrich',
  '_': 'Unterstrich',
  '+': 'Plus',
  '/': 'Schrägstrich',
};

export function emailZumVorlesen(email: string): string {
  let ergebnis = email.trim();
  for (const [zeichen, wort] of Object.entries(ZEICHEN_MAPPING)) {
    ergebnis = ergebnis.split(zeichen).join(` ${wort} `);
  }
  return ergebnis.replace(/\s+/g, ' ').trim();
}
