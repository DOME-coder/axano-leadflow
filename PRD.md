# PRD – Produktanforderungsdokument
## Axano LeadFlow Plattform
**Version:** 1.0.0  
**Stand:** März 2026  
**Unternehmen:** Axano GmbH  
**Erstellt von:** Produktteam  
**Status:** Genehmigt zur Entwicklung

---

## 1. Zusammenfassung

Axano LeadFlow ist eine interne, webbasierte Lead-Management-Plattform, die alle eingehenden Leads aus verschiedenen Quellen (Facebook Lead Ads, Webformulare, E-Mail, WhatsApp, Webhooks) zentral erfasst, qualifiziert, verwaltet und automatisiert nachverfolgt. Die Plattform ersetzt den bisherigen n8n/Airtable-Workflow vollständig und bietet eine professionelle, skalierbare Alternative mit eigenem Dashboard, Kampagnenverwaltung, Automatisierungsengine und Reporting.

---

## 2. Hintergrund und Problemstellung

### 2.1 Aktueller Zustand (IST)

Axano verwaltet derzeit Lead-Kampagnen ausschließlich über n8n-Workflows in Kombination mit einer PostgreSQL-Datenbank und Airtable. Für jede neue Kampagne muss ein neuer n8n-Workflow manuell erstellt werden, der bis zu 270 einzelne Nodes enthält. Dies führt zu folgenden Problemen:

- **Hoher manueller Aufwand:** Jede Kampagne erfordert die Duplikation und Anpassung von hunderten Nodes
- **Keine zentrale Übersicht:** Lead-Daten sind über mehrere Tools verteilt
- **Keine Skalierbarkeit:** Mehr Kampagnen bedeuten exponentiell mehr Wartungsaufwand
- **Keine Benutzeroberfläche:** Alle Konfigurationen erfordern technisches Know-how
- **Fehleranfälligkeit:** Manuelle Kopien führen zu inkonsistenten Automatisierungen
- **Keine Echtzeit-Übersicht:** Status der Leads ist nicht zentral einsehbar

### 2.2 Gewünschter Zustand (SOLL)

Eine eigenständige Plattform, die:
- Leads aus beliebigen Quellen empfängt und normalisiert
- Pro Kampagne individuelle Felder und Automatisierungen erlaubt
- Den gesamten Lead-Lebenszyklus abbildet
- Ein visuelles Dashboard mit Kanban-Pipeline bietet
- Follow-up-Automationen (E-Mail, WhatsApp) ohne Code konfigurierbar macht
- Von einem kleinen Team (2–5 Personen) bedienbar ist

---

## 3. Ziele und Erfolgskriterien

### 3.1 Primäre Ziele

| Ziel | Messkriterium | Zielwert |
|------|--------------|----------|
| Zeitersparnis bei Kampagnenerstellung | Zeit von 0 auf erste eingehende Leads | < 15 Minuten (vorher: mehrere Stunden) |
| Zentrale Lead-Verwaltung | Alle Leads in einer Oberfläche | 100 % |
| Automatisierungsabdeckung | Automatisch bearbeitete Leads | > 95 % |
| Systemverfügbarkeit | Uptime | > 99,5 % |
| Teamadoption | Aktive Nutzer nach 4 Wochen | 100 % des Teams |

### 3.2 Nicht-Ziele (Out of Scope v1.0)

- KI-basierte Anruffunktion (VAPI oder ähnliches) – wird separat evaluiert
- Öffentliches Kundenportal / Mandantenfähigkeit
- Mobile Native App (iOS/Android)
- Rechnungsstellung oder CRM-Funktionen
- Integration mit externen CRM-Systemen (HubSpot, Salesforce)

---

## 4. Nutzer und Personas

### 4.1 Primäre Nutzer

**Persona 1: Kampagnenmanager (Max)**
- Erstellt und konfiguriert neue Kampagnen
- Verknüpft Facebook Lead Ads oder andere Quellen
- Definiert Pflichtfelder und Automatisierungen
- Braucht keine technischen Kenntnisse

**Persona 2: Lead-Bearbeiter (Lisa)**
- Sieht täglich eingehende Leads
- Ändert Status manuell bei Bedarf
- Fügt Notizen zu Leads hinzu
- Verfolgt Termine und Follow-ups

**Persona 3: Administrator (Tobias)**
- Verwaltet Benutzer und Zugriffsrechte
- Konfiguriert Integrationen (API-Keys, SMTP, WhatsApp)
- Überwacht Systemlogs und Fehler
- Hat Zugriff auf alle Kampagnen

---

## 5. Funktionale Anforderungen

### 5.1 Modul: Authentifizierung & Benutzerverwaltung

**F-AUTH-001:** Das System muss eine sichere Anmeldung per E-Mail und Passwort ermöglichen.  
**F-AUTH-002:** Passwörter müssen mit bcrypt (min. 12 Runden) gehasht gespeichert werden.  
**F-AUTH-003:** Sitzungen werden über JWT-Tokens (Ablauf: 8 Stunden) verwaltet.  
**F-AUTH-004:** Das System muss Refresh-Tokens (Ablauf: 30 Tage) unterstützen.  
**F-AUTH-005:** Es muss mindestens zwei Rollen geben: `admin` und `mitarbeiter`.  
**F-AUTH-006:** Admins können Benutzer anlegen, deaktivieren und Rollen vergeben.  
**F-AUTH-007:** Fehlgeschlagene Anmeldeversuche werden nach 5 Versuchen für 15 Minuten gesperrt.  
**F-AUTH-008:** Alle Authentifizierungsereignisse werden im Systemlog protokolliert.

### 5.2 Modul: Kampagnenverwaltung

**F-KAMP-001:** Benutzer können neue Kampagnen über einen 5-Schritte-Wizard erstellen.  
**F-KAMP-002:** Jede Kampagne hat: Name, Beschreibung, Trigger-Quelle, Felder, Automatisierungen, Status.  
**F-KAMP-003:** Kampagnen können aktiviert, pausiert und archiviert werden.  
**F-KAMP-004:** Jede Kampagne kann genau einen Trigger-Typ haben (Facebook, Webhook, E-Mail, WhatsApp, Formular).  
**F-KAMP-005:** Kampagnen-spezifische Felder können frei definiert werden (Text, Zahl, Datum, Auswahl, Ja/Nein).  
**F-KAMP-006:** Felder können als Pflichtfeld oder optional markiert werden.  
**F-KAMP-007:** Die Reihenfolge der Felder kann per Drag & Drop angepasst werden.  
**F-KAMP-008:** Kampagnen können dupliziert werden (inkl. Felder und Automatisierungen).  
**F-KAMP-009:** Jede Kampagne zeigt Echtzeit-Statistiken: Gesamt-Leads, Conversion-Rate, Leads heute.

### 5.3 Modul: Trigger & Lead-Eingang

**F-TRIG-001:** Facebook Lead Ads Trigger über offizielle Facebook-API (Webhooks).  
**F-TRIG-002:** Generischer Webhook-Trigger (HTTP POST, JSON-Body) mit anpassbarem URL-Slug.  
**F-TRIG-003:** E-Mail-Trigger über IMAP-Polling (alle 2 Minuten, konfigurierbar).  
**F-TRIG-004:** WhatsApp-Trigger über Superchat-API bei eingehenden Nachrichten.  
**F-TRIG-005:** Alle eingehenden Leads werden normalisiert: Vorname, Nachname, E-Mail, Telefon + kampagnenspezifische Felder.  
**F-TRIG-006:** Telefonnummern werden automatisch in das internationale Format (+49) konvertiert.  
**F-TRIG-007:** Duplikatserkennung: Leads mit gleicher Telefonnummer oder E-Mail innerhalb derselben Kampagne werden markiert.  
**F-TRIG-008:** Bei Eingang eines Leads wird sofort eine Echtzeit-Benachrichtigung im Dashboard angezeigt (WebSocket).  
**F-TRIG-009:** Fehlgeschlagene Webhook-Anfragen werden bis zu 3 Mal wiederholt (mit exponentieller Wartezeit).  
**F-TRIG-010:** Alle eingehenden Rohdaten werden im Eingangslog gespeichert (für Debugging).

### 5.4 Modul: Lead-Verwaltung & Pipeline

**F-LEAD-001:** Leads werden in einer Kanban-Pipeline mit konfigurierbaren Spalten dargestellt.  
**F-LEAD-002:** Standardspalten: Neu → In Bearbeitung → Follow-up → Nicht erreichbar → Termin gebucht → Nicht interessiert.  
**F-LEAD-003:** Lead-Status kann per Drag & Drop oder über das Lead-Detailformular geändert werden.  
**F-LEAD-004:** Jedes Lead-Profil zeigt: alle gesammelten Felder, Zeitstempel, Status-Historie, Notizen, Aktivitätslog.  
**F-LEAD-005:** Mitarbeiter können Notizen zu Leads hinzufügen (mit Zeitstempel und Autorname).  
**F-LEAD-006:** Leads können manuell einem Mitarbeiter zugewiesen werden.  
**F-LEAD-007:** Die Lead-Liste kann nach Kampagne, Status, Datum, Quelle und zugewiesenem Mitarbeiter gefiltert werden.  
**F-LEAD-008:** Leads können nach Name, E-Mail oder Telefon durchsucht werden (Volltextsuche).  
**F-LEAD-009:** Leads können als CSV exportiert werden (gefiltert oder gesamt).  
**F-LEAD-010:** Gelöschte Leads werden 90 Tage in einem Papierkorb aufbewahrt.  
**F-LEAD-011:** Die Status-Historie jedes Leads ist vollständig nachvollziehbar (wer hat was wann geändert).

### 5.5 Modul: Automatisierungen

**F-AUTO-001:** Pro Kampagne können unbegrenzt viele Automatisierungsregeln definiert werden.  
**F-AUTO-002:** Trigger für Automatisierungen: Lead eingetroffen, Status geändert, Zeit seit letzter Aktivität, Datum/Uhrzeit.  
**F-AUTO-003:** Aktionen für Automatisierungen: E-Mail senden, WhatsApp senden, Status setzen, Mitarbeiter benachrichtigen, Warten.  
**F-AUTO-004:** Wartezeiten können als feste Dauer (z. B. „30 Minuten") oder als Zeitpunkt (z. B. „nächster Werktag 09:00 Uhr") definiert werden.  
**F-AUTO-005:** Automatisierungen können mit Bedingungen verknüpft werden (z. B. „nur wenn Status = Neu").  
**F-AUTO-006:** E-Mail-Templates können mit Platzhaltervariablen ({{vorname}}, {{nachname}}, etc.) erstellt werden.  
**F-AUTO-007:** WhatsApp-Templates (Superchat) können pro Kampagne konfiguriert werden.  
**F-AUTO-008:** Zeitbasiertes Routing: Aktionen werden nur innerhalb definierter Zeitfenster ausgeführt (z. B. Mo–Fr, 09:00–20:00 Uhr).  
**F-AUTO-009:** Jede Automatisierungsaktion wird im Aktivitätslog des Leads protokolliert.  
**F-AUTO-010:** Fehlgeschlagene Automatisierungen werden im Fehlerlog erfasst und können manuell neu ausgelöst werden.  
**F-AUTO-011:** Automatisierungen können aktiviert/deaktiviert werden ohne die Kampagne zu pausieren.

### 5.6 Modul: Template-Verwaltung

**F-TMPL-001:** E-Mail-Templates können mit einem Rich-Text-Editor (HTML) erstellt werden.  
**F-TMPL-002:** Templates unterstützen dynamische Variablen: {{vorname}}, {{nachname}}, {{email}}, {{telefon}}, {{kampagne}} und alle kampagnenspezifischen Felder.  
**F-TMPL-003:** Templates können kampagnenübergreifend wiederverwendet werden.  
**F-TMPL-004:** Eine Vorschaufunktion zeigt das Template mit Beispieldaten.  
**F-TMPL-005:** Templates haben Versionierung – frühere Versionen können wiederhergestellt werden.  
**F-TMPL-006:** WhatsApp-Template-IDs (von Superchat) können pro Kampagne hinterlegt werden.

### 5.7 Modul: Kalender & Terminverwaltung

**F-KAL-001:** Calendly-Webhook-Integration: gebuchte Termine werden automatisch dem passenden Lead zugeordnet.  
**F-KAL-002:** Google Calendar Integration: Termine werden aus dem Kalender ausgelesen und angezeigt.  
**F-KAL-003:** Bei Terminbuchung wird der Lead-Status automatisch auf „Termin gebucht" gesetzt.  
**F-KAL-004:** Eine Kalenderansicht zeigt alle anstehenden Termine der nächsten 30 Tage.  
**F-KAL-005:** Termine können manuell im Lead-Profil eingetragen werden.

### 5.8 Modul: Analytics & Reporting

**F-ANA-001:** Das Dashboard zeigt KPIs für jede Kampagne: Gesamt-Leads, Conversion-Rate, Leads heute/diese Woche/diesen Monat.  
**F-ANA-002:** Funnel-Visualisierung: Wie viele Leads befinden sich in welcher Pipeline-Stufe.  
**F-ANA-003:** Zeitreihen-Diagramm: Lead-Eingang über Zeit (täglich, wöchentlich, monatlich).  
**F-ANA-004:** Quellen-Analyse: Welcher Trigger liefert die meisten / qualitativ besten Leads.  
**F-ANA-005:** Automatisierungs-Report: Wie viele E-Mails / WhatsApp-Nachrichten wurden gesendet.  
**F-ANA-006:** Export aller Reportdaten als CSV oder PDF.  
**F-ANA-007:** Vergleichsansicht: Kampagnen nebeneinander vergleichen.

### 5.9 Modul: Integrationen & API

**F-INT-001:** REST-API mit vollständiger CRUD-Funktionalität für alle Ressourcen.  
**F-INT-002:** Webhook-Endpunkt für eingehende Leads (öffentlich, mit HMAC-Signaturprüfung).  
**F-INT-003:** Facebook Lead Ads API-Integration (Graph API v18+).  
**F-INT-004:** E-Mail-Versand über SMTP (konfigurierbar: SendGrid, SES, eigener Server).  
**F-INT-005:** WhatsApp-Integration über Superchat-API.  
**F-INT-006:** Calendly-Webhook-Integration.  
**F-INT-007:** Google Calendar API-Integration (OAuth 2.0).  
**F-INT-008:** Alle API-Schlüssel werden verschlüsselt in der Datenbank gespeichert (AES-256).

---

## 6. Nicht-funktionale Anforderungen

### 6.1 Performance

- Seitenladezeit: < 2 Sekunden (P95)
- API-Antwortzeit: < 200 ms (P95)
- Lead-Verarbeitung bei Eingang: < 5 Sekunden
- Gleichzeitige Nutzer: bis zu 20 ohne Performance-Einbußen
- Datenbankabfragen: < 50 ms (P95, mit Indizes)

### 6.2 Sicherheit

- Alle Verbindungen über HTTPS (TLS 1.3)
- CSRF-Schutz auf allen Formularendpunkten
- Rate Limiting: max. 100 API-Anfragen pro Minute pro IP
- Webhook-Verifizierung über HMAC-SHA256-Signatur
- Keine sensiblen Daten in URL-Parametern
- Regelmäßige automatische Backups (täglich, 30 Tage Aufbewahrung)

### 6.3 Verfügbarkeit & Betrieb

- Ziel-Uptime: 99,5 %
- Geplante Wartungsfenster: Sonntag 02:00–04:00 Uhr
- Automatische Fehlerbenachrichtigung per E-Mail bei kritischen Fehlern
- Health-Check-Endpunkt: `GET /api/v1/health`
- Strukturiertes Logging (JSON) für alle Systemereignisse

### 6.4 Skalierbarkeit

- Horizontale Skalierbarkeit über Container (Docker)
- Datenbankverbindungen über Connection-Pooling (max. 20 gleichzeitig)
- Asynchrone Verarbeitung von Automatisierungen über Job-Queue
- Unterstützung für bis zu 50.000 Leads pro Kampagne

---

## 7. User Stories

### 7.1 Kampagnenerstellung

```
Als Kampagnenmanager
möchte ich eine neue Kampagne in einem geführten Wizard erstellen
damit ich innerhalb von 15 Minuten Leads empfangen kann.

Akzeptanzkriterien:
- Der Wizard hat 5 Schritte: Info, Trigger, Felder, Automatisierungen, Übersicht
- Jeder Schritt validiert die Eingaben vor dem Weiterschalten
- Nach Abschluss ist die Kampagne sofort aktiv
- Eine Webhook-URL wird automatisch generiert und angezeigt
```

### 7.2 Lead-Eingang

```
Als System
soll ein neuer Lead automatisch verarbeitet werden wenn ein Facebook Lead Ads Webhook eingeht
damit der Lead sofort in der Pipeline erscheint.

Akzeptanzkriterien:
- Lead erscheint innerhalb von 5 Sekunden in der Kanban-Ansicht
- Alle Felder werden korrekt normalisiert
- Telefonnummern sind im Format +49XXXXXXXXX
- Dopplungen werden erkannt und markiert
- Die konfigurierte Automatisierung wird sofort gestartet
```

### 7.3 Follow-up Automatisierung

```
Als Kampagnenmanager
möchte ich automatisch eine E-Mail senden wenn ein Lead nicht erreichbar ist
damit kein Lead ohne Nachverfolgung bleibt.

Akzeptanzkriterien:
- Automatisierung wird ausgelöst wenn Status auf "Nicht erreichbar" gesetzt wird
- E-Mail wird mit dem konfigurierten Template versendet
- Versand erfolgt nur Mo-Fr zwischen 09:00 und 20:00 Uhr
- Der Versand wird im Aktivitätslog des Leads protokolliert
- Bei Fehler wird der Admin benachrichtigt
```

### 7.4 Termin-Synchronisation

```
Als Lead-Bearbeiter
möchte ich sehen wenn ein Lead einen Termin über Calendly gebucht hat
damit der Status automatisch aktualisiert wird.

Akzeptanzkriterien:
- Calendly-Webhook löst automatische Statusänderung auf "Termin gebucht" aus
- Datum und Uhrzeit des Termins werden im Lead-Profil angezeigt
- Lead wird dem richtigen Datensatz zugeordnet (über E-Mail oder Telefon)
- Bei unbekanntem Lead wird der Admin per E-Mail benachrichtigt
```

---

## 8. Abhängigkeiten und Risiken

### 8.1 Externe Abhängigkeiten

| Service | Zweck | Risiko bei Ausfall |
|---------|-------|-------------------|
| Facebook Graph API | Lead Ads Trigger | Neue Leads kommen nicht an |
| Superchat API | WhatsApp-Versand | WhatsApp-Nachrichten nicht möglich |
| SMTP-Provider | E-Mail-Versand | E-Mails nicht möglich |
| Google Calendar API | Terminanzeige | Kalender nicht synchronisiert |
| Calendly | Terminbuchung | Automatische Statusänderung nicht möglich |

### 8.2 Technische Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Maßnahme |
|--------|-------------------|------------|----------|
| Facebook API-Änderungen | Mittel | Hoch | Versionierung, Monitoring |
| Datenbankausfall | Niedrig | Kritisch | Tägliche Backups, Replikation |
| Hohe Lead-Last | Niedrig | Mittel | Job-Queue, Rate Limiting |
| SMTP-Blockierung | Niedrig | Mittel | Alternativer Provider konfigurierbar |

---

## 9. Glossar

| Begriff | Definition |
|---------|------------|
| Lead | Ein potenzieller Kunde, der über eine Kampagne erfasst wurde |
| Kampagne | Eine konfigurierte Einheit mit Trigger, Feldern und Automatisierungen |
| Trigger | Die Quelle, über die Leads in die Plattform gelangen |
| Automatisierung | Eine Regelkette die bei bestimmten Ereignissen Aktionen ausführt |
| Pipeline | Die Kanban-Ansicht des Lead-Status-Verlaufs |
| Webhook | Ein HTTP-Endpunkt der von externen Diensten aufgerufen wird |
| Template | Eine wiederverwendbare E-Mail- oder Nachrichtenvorlage |
| HMAC | Hash-based Message Authentication Code – Signaturverfahren für Webhooks |

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
