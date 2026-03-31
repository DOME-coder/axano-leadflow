interface Bedingung {
  feld: string;
  operator: string;
  wert?: string;
}

interface LeadMitFelder {
  vorname?: string | null;
  nachname?: string | null;
  email?: string | null;
  telefon?: string | null;
  status: string;
  quelle?: string | null;
  [schluessel: string]: unknown;
}

/**
 * Prüft ob alle Bedingungen für einen Lead erfüllt sind (AND-Logik).
 */
export function bedingungenErfuellt(
  lead: LeadMitFelder,
  bedingungen: Bedingung[],
  felddaten?: Record<string, string | null>
): boolean {
  if (!bedingungen || bedingungen.length === 0) return true;

  return bedingungen.every((bedingung) => {
    const feldWert = feldWertAuslesen(lead, bedingung.feld, felddaten);

    switch (bedingung.operator) {
      case 'gleich':
        return String(feldWert ?? '') === String(bedingung.wert ?? '');

      case 'ungleich':
        return String(feldWert ?? '') !== String(bedingung.wert ?? '');

      case 'enthaelt':
        return String(feldWert ?? '').toLowerCase()
          .includes(String(bedingung.wert ?? '').toLowerCase());

      case 'nicht_leer':
        return feldWert != null && feldWert !== '';

      case 'ist_leer':
        return feldWert == null || feldWert === '';

      case 'groesser_als':
        return Number(feldWert) > Number(bedingung.wert);

      case 'kleiner_als':
        return Number(feldWert) < Number(bedingung.wert);

      default:
        return true;
    }
  });
}

function feldWertAuslesen(
  lead: LeadMitFelder,
  feld: string,
  felddaten?: Record<string, string | null>
): string | null | undefined {
  // Standardfelder direkt am Lead
  if (feld in lead) {
    const wert = lead[feld];
    return wert != null ? String(wert) : null;
  }

  // Kampagnenspezifische Felddaten
  if (felddaten && feld in felddaten) {
    return felddaten[feld];
  }

  return undefined;
}
