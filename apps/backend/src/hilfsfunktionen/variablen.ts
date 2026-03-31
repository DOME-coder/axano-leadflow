interface LeadFuerVariablen {
  vorname?: string | null;
  nachname?: string | null;
  email?: string | null;
  telefon?: string | null;
  status: string;
  erstelltAm: Date;
  kampagne?: { name: string } | null;
  zugewiesener?: { vorname: string; nachname?: string } | null;
  felddaten?: Array<{
    feld: { feldname: string };
    wert: string | null;
  }>;
}

/**
 * Löst Template-Variablen ({{vorname}}, {{feld_xyz}}) in einem Text auf.
 */
export function variablenAufloesen(vorlage: string, lead: LeadFuerVariablen): string {
  const variablen: Record<string, string> = {
    vorname: lead.vorname ?? '',
    nachname: lead.nachname ?? '',
    email: lead.email ?? '',
    telefon: lead.telefon ?? '',
    status: lead.status,
    kampagne_name: lead.kampagne?.name ?? '',
    erstellt_am: lead.erstelltAm.toLocaleDateString('de-DE'),
    zugewiesen_an: lead.zugewiesener
      ? `${lead.zugewiesener.vorname} ${lead.zugewiesener.nachname ?? ''}`.trim()
      : 'Axano Team',
  };

  // Kampagnenspezifische Felder
  if (lead.felddaten) {
    for (const fd of lead.felddaten) {
      variablen[`feld_${fd.feld.feldname}`] = fd.wert ?? '';
    }
  }

  return vorlage.replace(/\{\{(\w+)\}\}/g, (_, schluessel: string) =>
    variablen[schluessel] ?? `{{${schluessel}}}`
  );
}
