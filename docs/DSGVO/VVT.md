# Verzeichnis von Verarbeitungstätigkeiten (VVT)

gemäß Art. 30 DSGVO

**Stand:** 28.04.2026
**Version:** 1.0

---

## 1. Verantwortlicher

| Feld | Wert |
|---|---|
| Firmenname | Axano GmbH |
| Adresse | Stettener Hauptstraße 62, 70771 Leinfelden-Echterdingen, Deutschland |
| Geschäftsführer | Luca Montalti, Fynn Gehrung |
| Telefon | +49 711 96939999 |
| E-Mail | team@axano.com |
| Website | www.axano.com |
| Handelsregister | HRB 800700, Amtsgericht Stuttgart |
| Datenschutzbeauftragter | Nicht bestellt (unter den Voraussetzungen des Art. 37 DSGVO nicht verpflichtend) |

---

## 2. Verarbeitungstätigkeit: Lead-Qualifizierung

### 2.1 Bezeichnung und Zweck

| Feld | Wert |
|---|---|
| Bezeichnung | Automatisierte Lead-Qualifizierung über Axano LeadFlow |
| Zweck | Qualifizierung von Interessenten (Leads) im Auftrag der Kunden von Axano GmbH mittels automatisierter KI-Anrufe, Analyse und Follow-up-Kommunikation |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. a DSGVO (Einwilligung der betroffenen Person) sowie Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung gegenüber dem Axano-Kunden) |
| Berechtigte Interessen | Entfällt (Einwilligung ist primäre Rechtsgrundlage für Kontaktaufnahme mit Endkunden) |

### 2.2 Kategorien betroffener Personen

- Endkunden der Axano-Kunden (B2C-Privatpersonen), die über Facebook Lead Ads, Webformulare oder andere Kanäle Interesse signalisiert haben
- Mitarbeiter der Axano-Kunden (B2B-Kontakte, soweit in der Plattform angelegt)

### 2.3 Kategorien personenbezogener Daten

| Kategorie | Inhalt |
|---|---|
| Kontaktdaten | Vorname, Nachname, E-Mail-Adresse, Telefonnummer |
| Kommunikationsdaten | Gesprächstranskripte aus KI-Anrufen, WhatsApp-Nachrichten, E-Mail-Korrespondenz |
| Qualifizierungsdaten | Antworten auf Qualifizierungsfragen (kampagnenspezifisch, z.B. Versicherungsbedarf, Interessen) |
| Metadaten | Zeitpunkt des Lead-Eingangs, Anrufversuche, Lead-Status, Aktivitätenprotokoll |
| Einwilligungsdaten | Zeitpunkt, Quelle und Text der erteilten Einwilligung zur Kontaktaufnahme |
| Terminbuchungsdaten | Datum, Uhrzeit und Inhalt gebuchter Beratungstermine (sofern gebucht) |

### 2.4 Empfänger und Auftragsverarbeiter

Folgende Dienstleister erhalten im Rahmen der Verarbeitung Zugriff auf personenbezogene Daten:

| Anbieter | Zweck | Sitz | Rechtsgrundlage Transfer |
|---|---|---|---|
| VAPI Inc. | KI-Telefonanrufe, Sprachverarbeitung | USA | Standardvertragsklauseln (SCC) gem. Art. 46 DSGVO |
| Anthropic PBC | KI-Analyse von Gesprächstranskripten (Claude API) | USA | SCC gem. Art. 46 DSGVO + DPA |
| Meta Platforms Ireland Ltd. | Facebook Lead Ads, WhatsApp Business API | EU (Irland) | Kein Drittlandstransfer (EU-Sitz) |
| Sentry (Functional Software Inc.) | Fehlermonitoring, Crash-Reports | USA | SCC gem. Art. 46 DSGVO + DPA |
| Calendly LLC | Terminbuchung | USA | SCC gem. Art. 46 DSGVO + DPA |
| Hetzner Online GmbH (Coolify-Hosting) | Server-Hosting, Datenbankbetrieb | DE (EU) | Kein Drittlandstransfer |

### 2.5 Löschfristen

| Datenkategorie | Frist |
|---|---|
| Lead-Stammdaten | 24 Monate nach letztem Kontakt, dann Löschung oder Anonymisierung |
| Gesprächstranskripte | 6 Monate nach Erstellung |
| Einwilligungsnachweise | 3 Jahre (Verjährungsfrist für zivilrechtliche Ansprüche) |
| Buchungsdaten | 10 Jahre (handels- und steuerrechtliche Aufbewahrungspflicht) |
| Log-Dateien (System) | 90 Tage, dann automatische Rotation |

### 2.6 Technische und organisatorische Maßnahmen (TOMs)

- Verschlüsselung aller gespeicherten API-Schlüssel und Zugangsdaten (AES-256-GCM)
- Verschlüsselte Übertragung aller Daten via TLS 1.2/1.3 (HTTPS)
- Zugriffssteuerung via JWT-Authentifizierung mit Rollen-Konzept (Admin, Mitarbeiter, Kunde)
- Brute-Force-Schutz auf Login-Endpunkt (max. 20 Versuche pro 15 Minuten pro IP)
- Webhook-Signatur-Prüfung (HMAC-SHA256) für eingehende Daten von Facebook, VAPI, Calendly
- Separater Datenbankzugriff pro Mandant durch technische Filterung (kundeId-Pflicht-Constraint)
- Automatische Backups der Produktionsdatenbank (täglich, 14 Tage Aufbewahrung)
- Fehlermonitoring via Sentry (ohne Übertragung von PII in Stack-Traces, soweit technisch möglich)
- Separate Entwicklungs- und Produktionsumgebung

---

## 3. Aktualisierungshistorie

| Datum | Version | Änderung |
|---|---|---|
| 28.04.2026 | 1.0 | Erststellung für Axano LeadFlow |

---

> ⚠️ **Hinweis:** Dieses Dokument ist ein Entwurf und muss von einem auf Datenschutzrecht spezialisierten Rechtsanwalt geprüft und freigegeben werden.
