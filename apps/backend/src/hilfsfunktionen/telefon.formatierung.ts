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

/**
 * Prüft ob eine Telefonnummer eine deutsche Mobilnummer ist.
 * Mobilnummern beginnen mit 015x, 016x, 017x (nach Normalisierung: +4915x, +4916x, +4917x).
 */
export function istHandynummer(telefon: string): boolean {
  const normalisiert = telefonNormalisieren(telefon);
  if (!normalisiert) return false;

  const mobilVorwahlen = [
    '+49151', '+49152', '+49157', '+49159',
    '+49160', '+49162', '+49163',
    '+49170', '+49171', '+49172', '+49173', '+49174', '+49175', '+49176', '+49177', '+49178', '+49179',
  ];

  return mobilVorwahlen.some((vorwahl) => normalisiert.startsWith(vorwahl));
}
