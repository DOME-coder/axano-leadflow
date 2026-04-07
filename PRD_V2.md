# PRD v2.0 – Axano LeadFlow Plattform
## Vollständiges Produktanforderungsdokument
**Version:** 2.0.0  
**Stand:** März 2026  
**Unternehmen:** Axano GmbH  
**Status:** Definitiv – Grundlage für Entwicklung

---

## 1. Produkt-Vision

Axano LeadFlow ist eine **interne B2B-Plattform** der Axano GmbH. Axano bietet Unternehmenskunden einen vollständig automatisierten Lead-Qualifizierungsdienst an. Der Kunde liefert Leads (über Facebook Ads, Webformulare, etc.) – Axano übernimmt den gesamten Kontaktprozess: KI-Telefonate, E-Mails, WhatsApp – mit dem Ziel, einen **Termin zu vereinbaren**.

### Kernprinzip
> Ein Lead kommt an → Daten werden gesammelt → KI kontaktiert automatisch → Termin wird vereinbart

Die Plattform ersetzt vollständig den bisherigen n8n-Workflow (270 Nodes) und macht jeden Schritt konfigurierbar, ohne technisches Know-how zu benötigen.

---

## 2. Geschäftsmodell & Nutzer

### 2.1 Wer nutzt die Plattform?
- **Axano-Team (intern):** Erstellt und verwaltet Kampagnen für Kunden
- **Axano-Kunden (Unternehmen):** Erhalten Leads und wollen diese automatisch qualifizieren lassen

### 2.2 Was bietet Axano dem Kunden?
1. Lead-Eingang aus beliebigen Quellen (Facebook, Web, Email, WhatsApp)
2. Sofortige automatische Kontaktaufnahme per KI-Telefon (VAPI)
3. Follow-up per E-Mail und/oder WhatsApp bei Nichterreichbarkeit
4. Terminvereinbarung als Endziel
5. Dashboard zur Überwachung aller Leads und Ergebnisse

### 2.3 Konfigurierbarkeit pro Kampagne
Jede Kampagne kann folgende Kanäle **aktivieren oder deaktivieren**:
- ✅/❌ VAPI KI-Telefonat
- ✅/❌ E-Mail automatisch
- ✅/❌ WhatsApp (Superchat)
- ✅/❌ Interne Benachrichtigung (Team)

---

## 3. Die Lead-Journey – Schritt für Schritt

### SCHRITT 1: Lead-Eingang & Datenspeicherung

**Ablauf:**
1. Lead kommt über konfigurierten Kanal an (Facebook, Webhook, E-Mail, WhatsApp, Webformular)
2. System normalisiert die Daten:
   - Telefonnummer → internationales Format (+49)
   - Vorname/Nachname extrahiert
   - Pflichtfelder validiert
   - Kampagnenspezifische Felder gespeichert
3. Duplikatsprüfung (gleiche E-Mail ODER Telefon in gleicher Kampagne)
4. Lead wird in PostgreSQL gespeichert
5. Status: **"Neu"**
6. Echtzeit-Benachrichtigung im Dashboard (WebSocket)

**Wichtig:** Der Lead muss vollständig gespeichert sein BEVOR die Automatisierung startet.

---

### SCHRITT 2: KI-Telefonat (VAPI) – falls aktiviert

**Sofortiger Start** nach Lead-Speicherung (innerhalb von 60 Sekunden).

**2.1 Zeitrouting vor jedem Anruf:**
```
Aktuelle Uhrzeit prüfen:
- Vor 09:00 Uhr    → warte bis heute 09:00 Uhr
- 09:00–21:00 Uhr  → sofort anrufen
- Nach 21:00 Uhr   → warte bis morgen 09:00 Uhr
- Wochenende       → warte bis Montag 09:00 Uhr
Zufallsverzögerung: ±0–10 Minuten (wirkt natürlicher)
```

**2.2 Telefonnummer-Erkennung:**
- Handynummer → VAPI-Anruf möglich
- Festnetznummer → VAPI-Anruf möglich (andere Konfiguration)
- Ungültige Nummer → Status "Falsche Nummer", Follow-up per E-Mail/WA

**2.3 VAPI-Anruf starten:**
```
POST https://api.vapi.ai/call
{
  "assistant_id": "kampagnen-spezifischer-assistant-id",
  "phone_number": "+49XXXXXXXXX",
  "metadata": { "lead_id": "uuid", "kampagne_id": "uuid" }
}
```

**2.4 Status während Anruf:** "Anruf läuft (Versuch #N)"

---

### SCHRITT 3: VAPI End-of-Call Report verarbeiten

Nach jedem Anruf sendet VAPI einen Webhook an die Plattform.

**3.1 Webhook-Empfang:**
```
POST /api/v1/webhooks/vapi/end-of-call
{
  "message": {
    "type": "end-of-call-report",
    "endedReason": "...",
    "artifact": {
      "transcript": "Vollständiger Gesprächstext..."
    }
  },
  "metadata": { "lead_id": "...", "versuch_nr": 1 }
}
```

**3.2 endedReason-Prüfung (technische Fehler):**

| endedReason | Bedeutung | Aktion |
|-------------|-----------|--------|
| `call-start-error-*` | Anruf konnte nicht gestartet werden | Erneut versuchen (nächster Slot) |
| `assistant-error` | VAPI-Fehler | Erneut versuchen |
| `worker-shutdown` | Server-Problem | Erneut versuchen |
| `assistant-join-timed-out` | Timeout | Erneut versuchen |
| `customer-ended-call` | Kunde hat aufgelegt | GPT-Analyse starten |
| `assistant-ended-call` | KI hat beendet | GPT-Analyse starten |
| `voicemail` | Voicemail erkannt | Voicemail-Backup-Check |

**3.3 GPT-Transkript-Analyse:**

```
System-Prompt (unveränderlich):
"Du bist ein nützlicher, intelligenter Assistent, spezialisiert 
auf die Zusammenfassung und Analyse von Gesprächen/Transkripten."

User-Prompt:
"Du erhältst das Transkript eines Telefonats zwischen einem 
potenziellen Kunden und einem KI-Agenten. Fasse zusammen was 
passiert ist. Berücksichtige: Wurden Daten gesammelt? Wurde ein 
Termin vereinbart? Gib deine Antwort NUR als JSON zurück:
{
  'summary': '[Zusammenfassung auf Deutsch]',
  'verdict': '[callback scheduled|not interested|wrong number|voicemail|disconnected|hung up]'
}
Verdicts:
- callback scheduled = Rückruf vereinbart oder Termin gebucht
- not interested = Klar kein Interesse geäußert
- wrong number = Falsche Person erreicht
- voicemail = Direkt in Mailbox gelaufen
- disconnected = Unerwartet unterbrochen
- hung up = Sofort aufgelegt ohne echtes Gespräch"
```

**3.4 Voicemail-Backup-Check:**
Falls `endedReason = voicemail` aber Transkript vorhanden:
```
GPT prüft nochmals:
"War es wirklich Voicemail oder ein echtes Gespräch?"
Verdict: "voicemail" oder "call"
Falls "call" → normale GPT-Analyse starten
```

---

### SCHRITT 4: Entscheidung nach GPT-Verdict

| Verdict | Status setzen | Nächste Aktion |
|---------|--------------|----------------|
| `callback scheduled` | "Termin gebucht" | Follow-up Bestätigung, Calendly prüfen |
| `not interested` | "Nicht interessiert" | E-Mail/WA "Schade" senden (optional) |
| `wrong number` | "Falsche Nummer" | Admin benachrichtigen |
| `voicemail` | "Attempt #N" | Nächsten Anrufversuch planen |
| `disconnected` | "Attempt #N" | Nächsten Anrufversuch planen (sofort) |
| `hung up` | "Attempt #N" | Nächsten Anrufversuch planen |

---

### SCHRITT 5: Retry-Sequenz (bis 11 Versuche)

**Zeitplan der Anrufversuche:**
```
Tag 1: Sofort → 12:30 → 17:00 → 18:00 → 19:00
Tag 2: 09:00 → 12:30 → 17:00 → 18:00 → 19:00
Tag 3: 09:00 → 12:30 → 17:00
```

**Vor jedem Versuch prüfen:**
1. Wurde der Lead inzwischen erreicht? (Status ≠ Attempt) → Abbrechen
2. Ist die Kampagne noch aktiv? → Falls nicht, abbrechen
3. Zeitfenster einhalten → Falls außerhalb, verschieben

**Nach Versuch 1 (fehlgeschlagen):**
→ E-Mail "Verpasster Anruf" senden (falls E-Mail aktiviert)
→ WhatsApp Template "Anruf fehlgeschlagen" senden (falls WA aktiviert)

**Nach allen 11 Versuchen ohne Erfolg:**
→ Status: "Nicht erreichbar"
→ E-Mail "Unerreichbar" senden
→ WhatsApp Template "Unerreichbar" senden

---

### SCHRITT 6: Follow-up Kommunikation

**6.1 E-Mail Follow-up:**

| Trigger | Template | Betreff-Beispiel |
|---------|----------|-----------------|
| Versuch 1 fehlgeschlagen | "Verpasster Anruf" | "{{agent_name}} – kurzer Rückruf? 🐴" |
| Voicemail hinterlassen | "Voicemail-Follow-up" | "{{agent_name}} nochmal – wann passt es dir?" |
| Nicht erreichbar (alle Versuche) | "Unerreichbar" | "{{agent_name}} – wann passt es dir besser?" |
| Nicht interessiert | Optional | – |

**Zeitfenster für E-Mail-Versand:**
- Nur Mo–Fr, 09:00–20:00 Uhr
- Falls außerhalb → warte bis nächsten gültigen Slot

**6.2 WhatsApp Follow-up (Superchat):**

| Trigger | Template-ID | Aktion |
|---------|------------|--------|
| Versuch 1 fehlgeschlagen | konfigurierbar | Kontakt suchen → erstellen → Template senden |
| Nicht erreichbar | konfigurierbar | Template senden |
| Lead antwortet auf WA | – | Status "WhatsApp erhalten" setzen |

**Superchat-Ablauf:**
1. Kontakt per Telefonnummer suchen
2. Falls nicht vorhanden → Kontakt erstellen
3. Template-Nachricht mit Variablen senden ({{vorname}})
4. Antwort-Check nach 24h (Hat geantwortet? → Status aktualisieren)

---

### SCHRITT 7: Terminvereinbarung (Calendly)

**Automatischer Ablauf:**
1. Lead bucht Termin über Calendly-Link (im E-Mail oder WA enthalten)
2. Calendly sendet Webhook an Plattform
3. Lead-Zuordnung über E-Mail ODER Telefonnummer
4. Status → "Termin gebucht"
5. Termin in Google Calendar synchronisieren
6. Falls Lead nicht gefunden → Admin-E-Mail (Fallback)

---

## 4. AI-Auto-Generierung bei neuer Kampagne

### 4.1 Konzept
Wenn Axano eine neue Kampagne für einen Kunden erstellt, generiert die KI (Claude API) automatisch alle notwendigen Inhalte. Alles ist danach manuell anpassbar.

### 4.2 Was wird generiert?

**Input vom Axano-Team:**
- Branche des Kunden (z.B. "Pferdeversicherung")
- Produkt/Dienstleistung (z.B. "Krankenversicherung für Pferde")
- Zielgruppe (z.B. "Pferdebesitzer in Deutschland")
- Ton (z.B. "freundlich, persönlich")

**Output der KI:**

1. **VAPI-Gesprächs-Prompt** (vollständiges Skript für den KI-Agenten)
   - Begrüßung
   - Qualifizierungsfragen
   - Einwandbehandlung
   - Terminvereinbarungs-Flow
   - Verabschiedung

2. **E-Mail Templates** (3 Varianten):
   - "Verpasster Anruf" (nach Versuch 1)
   - "Nochmal versucht" (nach Voicemail)
   - "Letzte Nachricht" (nach allen Versuchen)

3. **WhatsApp Templates** (2 Varianten):
   - "Anruf fehlgeschlagen"
   - "Nicht erreichbar"

4. **Formularfelder** (kampagnenspezifisch):
   - Relevante Felder für die Branche
   - Pflichtfelder markiert
   - Reihenfolge optimiert

### 4.3 Anpassbarkeit
- Alle generierten Inhalte sind vollständig bearbeitbar
- Versionierung: jede Version wird gespeichert
- Vorschau mit echten Lead-Daten
- A/B-Testing möglich (2 E-Mail-Varianten)

---

## 5. Lead-Status-System (vollständig)

```
Neu
  └─ Anruf läuft (Versuch #1–11)
       ├─ Voicemail
       ├─ Hung Up
       ├─ Disconnected
       ├─ WhatsApp erhalten
       ├─ Falsche Nummer          → ENDE
       ├─ Nicht interessiert      → ENDE
       ├─ Nicht erreichbar        → ENDE (nach 11 Versuchen)
       └─ Termin gebucht          → ENDE (Erfolg)
```

**Alle Status im Detail:**

| Status | Beschreibung | Nächste Aktion |
|--------|-------------|----------------|
| Neu | Lead gerade eingegangen | Automatisierung starten |
| Anruf läuft | VAPI-Anruf aktiv | Warten auf End-of-Call |
| Attempt #1–11 | Versuch N abgeschlossen | Nächsten planen |
| Voicemail | Mailbox erreicht | Nächsten Versuch + WA/Email |
| Hung Up | Sofort aufgelegt | Nächsten Versuch |
| Disconnected | Unerwartet getrennt | Sofort nochmal versuchen |
| WhatsApp erhalten | Hat auf WA geantwortet | Manuell bearbeiten |
| Falsche Nummer | Falscher Kontakt | Admin benachrichtigen |
| Nicht interessiert | Kein Interesse | Abgeschlossen |
| Nicht erreichbar | 11 Versuche gescheitert | Follow-up gesendet |
| Termin gebucht | Calendly-Buchung | Erfolg |

---

## 6. Kampagnen-Konfiguration

### 6.1 Was wird pro Kampagne konfiguriert?

**Allgemein:**
- Name, Beschreibung, Kunde
- Lead-Quelle (Trigger-Typ)
- Formularfelder (AI-generiert oder manuell)

**Kanäle (ein/ausschalten):**
- VAPI aktiviert? + Assistant ID + Prompt
- E-Mail aktiviert? + SMTP-Konfiguration + Templates
- WhatsApp aktiviert? + Superchat Kanal-ID + Template-IDs
- Interne Benachrichtigung? + E-Mail-Adresse

**Anruf-Einstellungen:**
- Max. Anrufversuche (1–11, Standard: 11)
- Anrufzeiten (Standard: 09:00/12:30/17:00/18:00/19:00)
- Zeitzone (Standard: Europe/Berlin)
- Wochenenden anrufen? (Standard: Nein)

**Follow-up-Einstellungen:**
- E-Mail nach Versuch 1? (Standard: Ja)
- WA nach Versuch 1? (Standard: Ja)
- E-Mail bei Unerreichbar? (Standard: Ja)
- WA bei Unerreichbar? (Standard: Ja)
- Calendly-Link (optional)

### 6.2 Pipeline-Spalten (konfigurierbar)
Standard: Neu → In Bearbeitung → Follow-up → Nicht erreichbar → Termin gebucht → Nicht interessiert

Axano kann pro Kampagne eigene Spalten definieren.

---

## 7. Dashboard & UI

### 7.1 Hauptansicht (Kanban)
- Alle Leads in konfigurierbaren Spalten
- Live-Updates via WebSocket
- Lead-Karte zeigt: Name, Telefon, Quelle, Status, letzter Kontaktversuch
- Drag & Drop für manuelle Status-Änderung
- Klick → Detail-Panel

### 7.2 Lead-Detail-Panel
- Alle Kontaktdaten
- Alle kampagnenspezifischen Felder
- Komplette Status-Historie (wer, wann, was)
- Alle Aktivitäten (Anrufe, E-Mails, WA, Automatisierungen)
- GPT-Zusammenfassung der Telefonate
- Notizen (manuell hinzufügbar)
- Manuelle Status-Änderung

### 7.3 Kampagnen-Wizard (5 Schritte)
1. **Info:** Name, Beschreibung, Kunde, Branche
2. **Trigger:** Lead-Quelle auswählen + konfigurieren
3. **Felder:** AI-generiert oder manuell definieren
4. **Kanäle & Automatisierung:** VAPI/Email/WA aktivieren + Templates zuweisen
5. **Übersicht:** Alles prüfen + Kampagne starten

### 7.4 Analytics
- Leads gesamt, heute, diese Woche
- Conversion Rate (Termin gebucht / Gesamt)
- Anruf-Statistiken (erreicht, nicht erreicht, Voicemail)
- E-Mail-Öffnungsrate (falls SMTP unterstützt)
- Zeitreihen-Diagramme

---

## 8. Technische Anforderungen

### 8.1 VAPI-Integration
- Webhook-Empfang: `POST /api/v1/webhooks/vapi/end-of-call`
- Signaturverifikation (HMAC)
- Filter: nur `type = "end-of-call-report"` verarbeiten
- Retry-Queue in BullMQ für zuverlässige Verarbeitung

### 8.2 GPT-Integration (OpenAI)
- Modell: GPT-4o-mini (kosteneffizient)
- Prompt für Transkript-Analyse (unveränderlich, aus n8n extrahiert)
- JSON-Output erzwingen
- Voicemail-Backup-Check als separater Call

### 8.3 Zeitplanung
- BullMQ Delayed Jobs für Anruf-Zeitplanung
- Cron-Jobs für Inaktivitäts-Check (alle 15 Min)
- Timezone: Europe/Berlin für alle Zeitberechnungen
- Zufallsverzögerung: Math.random() * 10 Minuten

### 8.4 Superchat (WhatsApp)
- Kontakt suchen per Telefonnummer
- Kontakt erstellen falls nicht vorhanden
- Template senden mit Variablen ({{vorname}})
- Antwort-Check über Superchat-Webhook

### 8.5 Sicherheit
- Alle API-Keys AES-256-GCM verschlüsselt
- HMAC-Verifikation für alle eingehenden Webhooks
- JWT-Authentifizierung für alle API-Endpunkte
- Rate Limiting auf allen öffentlichen Endpunkten

---

## 9. Nicht-funktionale Anforderungen

| Anforderung | Zielwert |
|-------------|---------|
| Lead-Verarbeitung | < 60 Sekunden von Eingang bis erstem Anruf |
| API-Antwortzeit | < 200ms (P95) |
| Uptime | > 99,5% |
| Gleichzeitige Anrufe | bis zu 50 parallel (VAPI-Limit beachten) |
| Datensicherheit | DSGVO-konform, Daten in Deutschland |

---

## 10. Was diese Plattform NICHT macht (v1.0)

- Kein öffentliches Kundenportal (Kunden sehen kein Dashboard)
- Keine mobile App
- Kein eigenes CRM (nur Lead-Verwaltung)
- Keine Rechnungsstellung
- Keine Multi-Tenant-Architektur (alles intern bei Axano)

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
*Basiert auf: n8n-Workflow "Lead Kampagne Pferd Facebook" (270 Nodes) + Konzeptdokument "Lead-Qualifizierungs- und Terminvereinbarungssystem"*
