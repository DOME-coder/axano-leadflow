# Axano LeadFlow — Onboarding-Guide

Diese Anleitung erklärt **zwei Dinge**:
1. **Einmalige Plattform-Vorbereitung** (OAuth-Apps registrieren) — machst du als Axano-Admin **einmal** für die ganze Plattform
2. **Pro neuer Kunde** — die Schritte, die jedes Mal durchgegangen werden, wenn ein neuer Axano-Kunde an Bord kommt

---

## Teil 1 — Einmalige Plattform-Vorbereitung

Bevor du den ersten Kunden onboarden kannst, müssen zwei OAuth-Apps registriert werden, damit die Plattform Termine im Kalender deines Kunden eintragen darf.

### 1.1 Google Cloud OAuth-App

**Warum:** Damit dein Kunde seinen Google-Kalender verbinden kann und Termine dort automatisch landen.

1. Öffne **https://console.cloud.google.com/**
2. **Neues Projekt** anlegen (oben links Project-Picker → "New Project") → Name: `Axano LeadFlow`
3. Wähle das neue Projekt aus
4. **APIs & Services → Library** → Suche "Google Calendar API" → **Enable**
5. **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - App name: `Axano LeadFlow`
   - User support email: deine Axano-E-Mail
   - Developer contact: dieselbe E-Mail
   - **Save and continue**
   - Scopes: erstmal überspringen
   - Test users: füge **deine eigene Google-Mail** hinzu (für Tests, später kannst du publishen)
   - **Save**
6. **APIs & Services → Credentials** → **+ Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `Axano LeadFlow Backend`
   - **Authorized redirect URIs** → **Add URI** (genau diese eine URI, gilt für ALLE Kunden):
     ```
     https://leadflow.axano.com/api/v1/oauth/google/callback
     ```
   - **Create**
7. Im Popup erscheinen **Client ID** und **Client secret** — beide kopieren

### 1.2 Microsoft Azure OAuth-App (Outlook)

**Warum:** Damit Kunden mit Office365/Outlook ihren Kalender verbinden können.

1. Öffne **https://portal.azure.com/**
2. Suche oben: **App registrations** → klick darauf
3. **+ New registration**:
   - Name: `Axano LeadFlow`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: **Web** + URL (genau diese eine URI, gilt für ALLE Kunden):
     ```
     https://leadflow.axano.com/api/v1/oauth/outlook/callback
     ```
   - **Register**
4. Auf der App-Seite die **Application (client) ID** kopieren
5. **Certificates & secrets** → **New client secret** → Description "Axano LeadFlow", Expires "24 months" → **Add** → **Value** sofort kopieren (wird nur einmal angezeigt!)
6. **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions** → folgende auswählen:
   - `offline_access`
   - `Calendars.ReadWrite`
   - `OnlineMeetings.ReadWrite`
   - **Add permissions**

### 1.3 ENV-Variablen in Coolify setzen

In Coolify → Service `backend` → **Environment Variables** → folgende Werte eintragen oder aktualisieren:

```
GOOGLE_CLIENT_ID=<aus Schritt 1.1.7>
GOOGLE_CLIENT_GEHEIMNIS=<aus Schritt 1.1.7>

OUTLOOK_CLIENT_ID=<aus Schritt 1.2.4>
OUTLOOK_CLIENT_GEHEIMNIS=<aus Schritt 1.2.5>
OUTLOOK_TENANT_ID=common
```

Danach **Backend redeployen**.

### 1.4 Verifikation

- Logge dich in der Plattform ein
- Lege einen Test-Kunden an
- Öffne den Kunden → Sektion "Kunden-Integrationen" → bei "Google Calendar" klicke **Mit Google verbinden**
- Du wirst zu Google weitergeleitet → mit deinem Test-Account anmelden → Berechtigungen genehmigen
- Du landest zurück auf der Kunden-Seite mit `?google_calendar=verbunden` in der URL
- Das Badge sollte jetzt **"Eigene Konfiguration"** (orange) statt **"Global"** (grau) anzeigen

Dasselbe für Outlook testen.

---

## Teil 2 — Pro neuer Kunde (Onboarding-Checkliste)

Wenn ein neuer Axano-Kunde an Bord kommt (z. B. "Equilibra Pferdeversicherung"), gehst du diese Liste durch. **Geschätzte Zeit: ~30 Min** (mit dem Kunden zusammen am Telefon).

### Schritt 1 — Kunde anlegen

1. Plattform → **Kunden → + Neuer Kunde**
2. Felder ausfüllen:
   - **Name:** Firmenname des Kunden
   - **Branche:** z.B. "Pferdeversicherung", "Solartechnik", …
   - **Ansprechpartner:** Name des Hauptkontakts beim Kunden
   - **E-Mail:** Geschäfts-E-Mail des Hauptkontakts
   - **Telefon:** Geschäftsnummer
   - **Notizen:** alles Wichtige, was später hilft (z.B. erwartete Lead-Anzahl/Tag)
3. **Kunde erstellen** → Detail-Seite öffnet sich

### Schritt 2 — Kunden-Integrationen einrichten

Auf der Kunden-Detail-Seite scrollst du zur Sektion **"Kunden-Integrationen"**. Pro Service durchgehen:

#### 📞 VAPI (KI-Anrufe)
**Was du brauchst vom Kunden:** API-Key + Assistant-ID + Phone-Number-ID aus seinem VAPI-Account

1. **Konfigurieren** klicken
2. Eintragen:
   - `api_schluessel`: VAPI API Key (aus dem VAPI Dashboard → Settings → API Keys)
   - `assistant_id`: Die ID des Assistenten, der für diesen Kunden konfiguriert wurde
   - `phone_number_id`: Die ID der Telefonnummer, von der die KI anrufen soll
3. **Aktiv** anhaken
4. **Speichern**

> ⚠️ Wichtig: Diese 3 Werte müssen aus dem **eigenen VAPI-Account des Kunden** kommen. Falls Axano selbst die VAPI-Sub-Accounts verwaltet, dann eben aus dem Sub-Account. Niemals den globalen Axano-Assistenten verwenden, sonst kommen alle Anrufe von derselben Nummer.

#### 📅 Google Calendar
**Was du brauchst vom Kunden:** Login zu seinem Google-Konto

1. **Mit Google verbinden** klicken
2. Du (oder der Kunde) wird zu Google weitergeleitet
3. Mit dem **Google-Konto des Kunden** einloggen (nicht deinem Axano-Konto!)
4. Berechtigungen für "Axano LeadFlow" akzeptieren
5. Zurück auf der Kunden-Seite → Badge wechselt auf "Eigene Konfiguration"
6. Test: **manuell einen Termin im Plattform-Kalender anlegen** → sollte sofort im Google-Kalender des Kunden erscheinen

#### 📅 Outlook Calendar (alternative zu Google)
Wie Google, nur **Mit Outlook verbinden** klicken. Funktioniert mit Office365 und persönlichen Microsoft-Konten.

#### 📧 SMTP (E-Mail-Versand im Namen des Kunden)
**Was du brauchst vom Kunden:** SMTP-Zugangsdaten seines E-Mail-Anbieters (z.B. IONOS, Google Workspace, eigener Server)

1. **Konfigurieren** klicken
2. Eintragen:
   - `host`: z.B. `smtp.ionos.de` oder `smtp.gmail.com`
   - `port`: meistens `587` (TLS) oder `465` (SSL)
   - `benutzer`: vollständige E-Mail-Adresse
   - `passwort`: SMTP-Passwort (bei Gmail: App-Passwort, nicht das normale!)
   - `absender_name`: Anzeigename, z.B. "Equilibra Beratung"
   - `absender_email`: Absender-Adresse (oft = `benutzer`)
3. **Aktiv** anhaken
4. **Speichern**

> ⚠️ Bei Gmail/Google Workspace: der Kunde muss ein **App-Passwort** generieren (Google-Konto → Sicherheit → App-Passwörter). Sein normales Login-Passwort funktioniert nicht.

#### 💬 Calendly
**Was du brauchst vom Kunden:** Calendly-Account + Webhook-Signing-Key

1. Im Calendly-Account des Kunden: **Integrations → Webhooks → Create Webhook**
   - URL: `https://leadflow.axano.com/api/v1/webhooks/calendly`
   - Events: `Invitee Created`, `Invitee Canceled`
   - **Create**
2. Den **Signing Key** kopieren, der jetzt angezeigt wird
3. Zurück in Axano LeadFlow → Kunde → Calendly → **Konfigurieren**
4. `webhook_signing_key` eintragen → Speichern + Aktiv
5. **Test:** Im Calendly-Account ein Test-Termin buchen mit der E-Mail eines vorhandenen Test-Leads → der Lead-Status sollte automatisch auf "Termin gebucht" wechseln und der Termin im Kunden-Kalender erscheinen

#### 📱 WhatsApp / Superchat (optional)
**Was du brauchst:** Superchat-Account des Kunden + API-Key + Channel-ID

1. **Konfigurieren** klicken
2. Eintragen: `api_schluessel`, `webhook_geheimnis`, `basis_url` (Default: `https://api.superchat.de`)
3. Aktiv + Speichern

#### 📘 Facebook Lead Ads (optional)
Falls der Kunde Leads aus Facebook Lead Ads bekommt:
1. Werte aus seiner Facebook App eintragen: `app_id`, `app_geheimnis`, `verify_token`, `seiten_zugriffstoken`

### Schritt 3 — Erste Kampagne anlegen

1. **Auf der Kunden-Detail-Seite oben** auf **+ Neue Kampagne** klicken (oder Sidebar → Kampagnen → Neu)
2. Wizard durchgehen:
   - **Schritt 1 (Info):** Kunde ist automatisch vorausgewählt. Branche, Produkt, Zielgruppe, Ton eintragen
   - **Schritt 2 (Trigger):** Lead-Quelle wählen (Webhook, Facebook, Webformular, …)
   - **Schritt 3 (Felder):** Mit AI generieren oder manuell definieren
   - **Schritt 4 (Kanäle):**
     - VAPI **aktivieren**, aber Assistant-ID/Phone-ID **leer lassen** → wird automatisch aus der Kunden-Integration gezogen
     - Email aktivieren → automatisch generierte Templates nutzen
     - WhatsApp aktivieren falls relevant
   - **Schritt 5 (Übersicht):** Speichern

### Schritt 4 — End-to-End Test

1. **Test-Lead per Webhook injizieren** (mit deiner eigenen Mobilnummer + Test-E-Mail):
   ```bash
   curl -X POST https://leadflow.axano.com/api/v1/webhooks/<KAMPAGNE-SLUG> \
     -H "Content-Type: application/json" \
     -d '{
       "vorname": "Test",
       "nachname": "Lead",
       "email": "DEINE-TEST-EMAIL@gmail.com",
       "telefon": "+49DEINE-HANDYNR"
     }'
   ```

2. **Was du beobachten solltest:**
   - Lead erscheint sofort im Kanban (WebSocket-Echtzeit)
   - **Anruf kommt von der Telefonnummer des Kunden** (nicht von Axano)
   - Wenn du den Termin vereinbarst → Termin landet im **Kalender des Kunden** (nicht in deinem)
   - Wenn du nicht abnimmst → Follow-up-Email kommt **vom SMTP des Kunden** (Absender = Kunde, nicht Axano)
   - Im Lead-Detail siehst du Status-Historie, GPT-Zusammenfassung, Termin

3. **Wenn etwas schiefgeht:**
   - Backend-Logs in Coolify oder per `docker logs` prüfen
   - Fehlermeldung zur entsprechenden Integration → meistens ein Tippfehler im API-Key oder ein falsches Format

### Schritt 5 — Live mit echten Leads

Wenn der End-to-End-Test funktioniert: Webhook-URL der Kampagne dem Kunden geben, damit er sie in seinem Lead-Provider eintragen kann (Facebook Lead Ads, Webformular, etc.).

---

## Troubleshooting

### "VAPI Assistant-ID oder Phone-Number-ID fehlt"
- Kunde hat keine VAPI-Integration konfiguriert UND die Kampagne hat auch keine Werte
- **Fix:** Werte in der Kunden-Integration eintragen (Kunde → VAPI → Konfigurieren)

### "Mit Google verbinden" leitet nicht weiter
- `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_GEHEIMNIS` fehlen in Coolify-ENV
- **Fix:** Teil 1 dieser Anleitung durchgehen

### Termin landet nicht im Google-Kalender des Kunden
- OAuth-Verbindung ist abgelaufen oder wurde nicht abgeschlossen
- **Fix:** Kunde → Google Calendar → "Auf global zurücksetzen" → erneut "Mit Google verbinden"

### E-Mail kommt vom Axano-Server statt vom Kunden-Server
- Kunden-SMTP-Integration ist nicht aktiv oder fehlt
- **Fix:** Kunde → SMTP → Konfigurieren → Werte eintragen → Aktiv anhaken

### Calendly-Termin synchronisiert nicht
- Webhook in Calendly nicht angelegt **oder** Signing Key falsch
- **Fix:** Schritt 2 / Calendly nochmal durchgehen
- **Test:** Im Backend-Log nach `Calendly Webhook` suchen — wenn nichts kommt, ist das Webhook in Calendly nicht aktiv
