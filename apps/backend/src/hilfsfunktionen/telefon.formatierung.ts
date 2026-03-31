/**
 * Normalisiert eine Telefonnummer in das internationale +49-Format.
 * Entfernt Leerzeichen, Bindestriche und Klammern.
 * Konvertiert führende 0 zu +49.
 */
export function telefonNormalisieren(rohTelefon: string | null | undefined): string | null {
  if (!rohTelefon) return null;

  let telefon = rohTelefon
    .replace(/[\s\-\(\)\/\.]/g, '')
    .trim();

  if (!telefon) return null;

  // Doppelte Null am Anfang (internationale Vorwahl ohne +)
  if (telefon.startsWith('0049')) {
    telefon = '+49' + telefon.substring(4);
  }

  // Führende 0 → +49
  if (telefon.startsWith('0')) {
    telefon = '+49' + telefon.substring(1);
  }

  // +490 → +49 (häufiger Fehler)
  if (telefon.startsWith('+490')) {
    telefon = '+49' + telefon.substring(4);
  }

  // Ohne + aber mit 49 am Anfang
  if (telefon.startsWith('49') && !telefon.startsWith('+')) {
    telefon = '+' + telefon;
  }

  return telefon;
}
