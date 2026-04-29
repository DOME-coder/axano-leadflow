# DSGVO-Dokumentation

Verzeichnis aller datenschutzrechtlichen Dokumente für Axano LeadFlow.
Hier abgelegt zur Versionierung und damit sie bei Audits, Anwaltsterminen oder
Behördenanfragen schnell auffindbar sind.

> **Hinweis Repo-Sichtbarkeit:** Dieses Repository ist aktuell öffentlich (GitHub).
> Daher gilt: Hier landen nur Dokumente, die **ohnehin öffentlich sein müssen
> oder dürfen** — Strukturdokumente (VVT, TIA, Datenschutzerklärung, Impressum).
> Sensible Anhänge gehören in den internen Drive (Notion/Google Drive), nicht
> in dieses Repo. Siehe Abschnitt „Was NICHT hierher" unten.

## Vorhandene Dokumente

| Dokument | Datei | Stand | Status |
|---|---|---|---|
| Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) | [VVT.md](./VVT.md) | 28.04.2026 | Entwurf — Anwaltsprüfung ausstehend |
| Transfer Impact Assessment (USA-Drittlandstransfers) | [TIA.md](./TIA.md) | 28.04.2026 | Entwurf — Anwaltsprüfung ausstehend |

## Erledigt

- ✅ **Mustertext-AV-Vertrag** für Kunden von Axano (DSGVO Art. 28) — anwaltlich freigegeben 29.04.2026, liegt im internen Drive. Verweis: [`../Vertraege/README.md`](../Vertraege/README.md)
- ✅ **Datenschutzerklärung §15 für Axano LeadFlow** — anwaltlich freigegeben 29.04.2026, live auf https://axano.com/datenschutz. Plattform `leadflow.axano.com/datenschutz` redirected automatisch dorthin (siehe [`apps/frontend/next.config.js`](../../apps/frontend/next.config.js)).
- ✅ **Impressum** — `leadflow.axano.com/impressum` redirected auf bestehendes Impressum unter https://axano.com/impressum (selbe GmbH).
- ✅ **Einwilligungs-Wortlaut für Kunden-Werbeformulare** (UWG §7 Abs. 2 Nr. 1) — anwaltlich freigegeben 29.04.2026. Mustertext: [`../Kunden/EINWILLIGUNG-MUSTER.md`](../Kunden/EINWILLIGUNG-MUSTER.md). Pro Kunde anwenden (Cannito et al.).

## Noch zu ergänzen

- **AV-Verträge mit Drittanbietern** (DSGVO Art. 28): VAPI, Anthropic, Meta, Sentry, Coolify/Hetzner, Calendly, Superchat. Status pro Anbieter sammeln.

## Was NICHT hierher gehört (interner Drive)

Folgende Dokumente sind **vertraulich** und gehören in den internen Drive
(z.B. Notion-Workspace „Axano / Recht / DSGVO"), **nicht** in dieses Repo:

- **Signierte AV-Verträge** mit Drittanbietern (enthalten Vertragsnummern, Account-IDs)
- **Anwaltstexte vor Veröffentlichung** (Mandantengeheimnis)
- **Konkrete Kundendaten** (Cannito-Verträge, Lead-Listen, Umsatzzahlen)
- **API-Keys, Passwörter, Tokens** — niemals, auch nicht in Beispielen oder Snippets
- **Echte Test-Datensätze** mit unmaskierten Telefonnummern oder E-Mail-Adressen
- **Sentry-DSN, VAPI-Webhook-Secret** — gehören in Coolify-Env, nicht ins Repo

## Pflege

- Bei Änderungen am System (neue Auftragsverarbeiter, geänderte Datenkategorien, neue Verarbeitungszwecke): VVT aktualisieren und Versionsnummer erhöhen.
- Bei Wechsel oder Hinzufügen eines Drittanbieters mit Sitz außerhalb der EU: TIA prüfen und gegebenenfalls ergänzen.
- Aktualisierungshistorie in jedem Dokument fortführen.
