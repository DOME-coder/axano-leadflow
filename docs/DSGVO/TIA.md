# Transfer Impact Assessment (TIA)

Übermittlungsfolgenabschätzung für Drittlandstransfers gemäß Art. 46 DSGVO

**Axano GmbH** | **Stand:** 29.04.2026 | **Version:** 1.1

---

## 1. Allgemeine Informationen

| Feld | Wert |
|---|---|
| Exporteur | Axano GmbH, Stettener Hauptstraße 62, 70771 Leinfelden-Echterdingen |
| Zweck der Übermittlung | KI-gestützte Lead-Qualifizierung über die Plattform Axano LeadFlow |
| Betroffene Kategorien | B2C-Interessenten (Leads): Name, Telefon, E-Mail, Gesprächstranskripte |
| Rechtsgrundlage Transfer | Standardvertragsklauseln (SCC) gem. Beschluss 2021/914 der EU-Kommission |
| Datum der Bewertung | 28.04.2026 |

---

## 2. Bewertung pro Empfänger

### 2.1 VAPI Inc. (USA)

| Feld | Wert |
|---|---|
| Anbieter | VAPI Inc. |
| Sitz | USA |
| Dienst | KI-Telefonanrufe und Sprachverarbeitung |
| Übertragene Daten | Telefonnummern, Gesprächsinhalte (Audio/Transkript), kampagnenspezifische Prompt-Daten |
| DPA vorhanden | Ja – über https://vapi.ai/legal/dpa zu unterzeichnen |
| SCC vereinbart | Im Rahmen des DPA enthalten (zu prüfen und zu unterzeichnen) |

**Risikoanalyse VAPI:**

- US-Recht FISA 702 erlaubt US-Behörden potenziellen Zugriff auf Daten bei US-Unternehmen
- Gesprächstranskripte enthalten personenbezogene Daten der Leads
- Schutzmaßnahmen: TLS-Verschlüsselung bei Übertragung, SCC als Rechtsgrundlage, Datensparsamkeit durch kurze Aufbewahrungsfristen
- **Residualrisiko: Mittel** — akzeptabel da SCC vereinbart und keine Anhaltspunkte für konkrete Behördenanfragen bekannt

### 2.2 Anthropic PBC (USA)

| Feld | Wert |
|---|---|
| Anbieter | Anthropic PBC |
| Sitz | USA |
| Dienst | KI-Analyse von Gesprächstranskripten (Claude API) |
| Übertragene Daten | Gesprächstranskripte, kampagnenspezifische Prompts (keine direkten Kontaktdaten im Prompt wenn möglich) |
| DPA vorhanden | Ja – https://www.anthropic.com/legal/dpa |
| SCC vereinbart | Im Rahmen des DPA enthalten |

**Risikoanalyse Anthropic:**

- Gleiche US-rechtliche Risiken wie bei VAPI (FISA 702)
- Transkripte werden für Analyse übertragen, nicht dauerhaft gespeichert (gemäß Anthropic-DPA)
- Schutzmaßnahmen: Minimierung der übertragenen PII (kein Klarname wenn vermeidbar), SCC, Anthropic-Datenschutzrichtlinien
- **Residualrisiko: Mittel** — akzeptabel

### 2.3 Sentry, Inc. (USA)

| Feld | Wert |
|---|---|
| Anbieter | Sentry, Inc. |
| Sitz | USA |
| Dienst | Fehlermonitoring, Crash-Reports |
| Übertragene Daten | Technische Fehlermeldungen, Stack-Traces (können potenziell PII enthalten bei Fehlern in datentragenden Pfaden) |
| DPA vorhanden | Ja – https://sentry.io/legal/dpa/ |
| Konfiguration | `sendDefaultPii: false` (kein automatisches Mitsenden von PII) |

**Risikoanalyse Sentry:**

- Geringeres Risiko als VAPI/Anthropic, da primär technische Daten übertragen werden
- `sendDefaultPii: false` konfiguriert, minimiert PII-Übertragung
- Zusätzlich: PII-Scrubbing-Layer in `beforeSend` maskiert E-Mail-Adressen und Telefonnummern in Events, Breadcrumbs und Exception-Strings
- SCC vereinbart im DPA
- **Residualrisiko: Niedrig** — akzeptabel

### 2.4 Calendly LLC (USA)

| Feld | Wert |
|---|---|
| Anbieter | Calendly LLC |
| Sitz | USA |
| Dienst | Online-Terminbuchung |
| Übertragene Daten | Name, E-Mail, Telefon, gewünschter Termin (nur bei Leads, die aktiv einen Termin buchen) |
| DPA vorhanden | Ja – über Calendly-Account-Einstellungen abrufbar |
| SCC vereinbart | Im Rahmen des DPA |

**Risikoanalyse Calendly:**

- Datenübertragung nur bei aktiver Terminbuchung durch den Lead
- Lead hat aktiv Terminbuchungslink aufgerufen (faktische Einwilligung)
- SCC vereinbart
- **Residualrisiko: Niedrig** — akzeptabel

---

## 3. Gesamtbewertung und Schlussfolgerung

Die Übermittlungen in die USA an VAPI, Anthropic, Sentry und Calendly erfolgen auf Basis von Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO (Beschluss 2021/914).

Die Risiken wurden bewertet und durch folgende Maßnahmen auf ein akzeptables Niveau gesenkt:

- Abschluss von Datenverarbeitungsverträgen (DPA) mit SCC-Klauseln bei allen US-Anbietern
- Technische Schutzmaßnahmen (Verschlüsselung, Datensparsamkeit, kurze Aufbewahrungsfristen)
- Keine Übertragung von Sonderkategorien nach Art. 9 DSGVO (keine Gesundheits-, Rassen- oder religiöse Daten)
- Regelmäßige Überprüfung der Anbieter-DPAs (mindestens jährlich)

**Fazit:** Die Übermittlungen sind unter den genannten Voraussetzungen mit der DSGVO vereinbar. Eine regelmäßige Neubewertung (mindestens jährlich oder bei wesentlichen Änderungen) ist erforderlich.

---

## 4. Nächste Schritte (Aufgabenliste)

| ✓ | Aufgabe | Verantwortlich | Erledigt |
|---|---|---|---|
| ☐ | DPA mit VAPI unterzeichnen (vapi.ai/legal/dpa) | Axano GmbH | |
| ☐ | DPA mit Anthropic unterzeichnen (anthropic.com/legal/dpa) | Axano GmbH | |
| ☐ | DPA mit Sentry unterzeichnen (sentry.io/legal/dpa) | Axano GmbH | |
| ☐ | DPA mit Calendly unterzeichnen (Calendly Account-Einstellungen) | Axano GmbH | |
| ☐ | DPA mit Meta WhatsApp Business (Business Manager → Settings) | Axano GmbH | |
| ☐ | DPA mit Hetzner (Coolify-Hosting) prüfen | Axano GmbH | |
| ☐ | TIA jährlich überprüfen und aktualisieren | Axano GmbH | |
| ☐ | Anwalt für finale Prüfung dieses Dokuments beauftragen | Geschäftsführung | |

---

## 5. Aktualisierungshistorie

| Datum | Version | Änderung |
|---|---|---|
| 28.04.2026 | 1.0 | Erststellung für Axano LeadFlow |
| 29.04.2026 | 1.1 | Sentry-Firmenname auf „Sentry, Inc." korrigiert. |

---

> ⚠️ **Hinweis:** Dieses Dokument ist ein Entwurf und muss von einem auf Datenschutzrecht spezialisierten Rechtsanwalt geprüft und freigegeben werden.
