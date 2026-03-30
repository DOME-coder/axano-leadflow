# API – REST API Dokumentation
## Axano LeadFlow Plattform
**Version:** v1  
**Basis-URL:** `https://leadflow.axano.de/api/v1`  
**Authentifizierung:** Bearer Token (JWT)

---

## 1. Authentifizierung

### POST /auth/anmelden
Benutzer anmelden und Token erhalten.

**Request:**
```json
{
  "email": "max@axano.de",
  "passwort": "sicheres-passwort"
}
```

**Response 200:**
```json
{
  "erfolg": true,
  "daten": {
    "access_token": "eyJhbGci...",
    "benutzer": {
      "id": "uuid",
      "email": "max@axano.de",
      "vorname": "Max",
      "nachname": "Mustermann",
      "rolle": "admin"
    }
  }
}
```

**Response 401:**
```json
{ "erfolg": false, "fehler": "Ungültige Anmeldedaten" }
```

---

### POST /auth/token-erneuern
Access Token mit Refresh Token erneuern.

**Response 200:**
```json
{
  "erfolg": true,
  "daten": { "access_token": "eyJhbGci..." }
}
```

---

### POST /auth/abmelden
Sitzung beenden und Refresh Token widerrufen.

**Response 200:**
```json
{ "erfolg": true, "nachricht": "Erfolgreich abgemeldet" }
```

---

## 2. Kampagnen

### GET /kampagnen
Alle Kampagnen abrufen.

**Query-Parameter:**
- `status` – `aktiv` | `pausiert` | `archiviert`
- `seite` – Seitennummer (Standard: 1)
- `pro_seite` – Einträge pro Seite (Standard: 20, Max: 100)

**Response 200:**
```json
{
  "erfolg": true,
  "daten": {
    "eintraege": [
      {
        "id": "uuid",
        "name": "Pferdeversicherung Facebook",
        "trigger_typ": "facebook_lead_ads",
        "status": "aktiv",
        "statistiken": {
          "gesamt_leads": 247,
          "leads_heute": 12,
          "conversion_rate": 13.7
        },
        "erstellt_am": "2026-01-15T10:00:00Z"
      }
    ],
    "gesamt": 5,
    "seite": 1,
    "pro_seite": 20
  }
}
```

---

### POST /kampagnen
Neue Kampagne erstellen.

**Request:**
```json
{
  "name": "Neue Kampagne",
  "beschreibung": "Kampagnenbeschreibung",
  "trigger_typ": "facebook_lead_ads",
  "trigger_konfiguration": {
    "seiten_id": "360658900474401",
    "formular_id": "9801879646507789",
    "zugriffstoken": "EAABsb..."
  },
  "felder": [
    {
      "feldname": "pferd_rasse",
      "bezeichnung": "Rasse des Pferdes",
      "feldtyp": "text",
      "pflichtfeld": false,
      "reihenfolge": 1
    }
  ]
}
```

**Response 201:**
```json
{
  "erfolg": true,
  "daten": {
    "id": "uuid",
    "name": "Neue Kampagne",
    "webhook_url": "https://leadflow.axano.de/api/v1/webhooks/neue-kampagne-abc123",
    "erstellt_am": "2026-03-30T09:00:00Z"
  }
}
```

---

### GET /kampagnen/:id
Einzelne Kampagne abrufen.

### PATCH /kampagnen/:id
Kampagne aktualisieren.

**Request (nur geänderte Felder):**
```json
{
  "name": "Neuer Name",
  "status": "pausiert"
}
```

### DELETE /kampagnen/:id
Kampagne archivieren (kein hartes Löschen).

### POST /kampagnen/:id/duplizieren
Kampagne mit allen Feldern und Automatisierungen duplizieren.

---

## 3. Leads

### GET /kampagnen/:kampagne_id/leads
Leads einer Kampagne abrufen.

**Query-Parameter:**
- `status` – Lead-Status filtern
- `zugewiesen_an` – Benutzer-UUID
- `suche` – Volltextsuche
- `von` – Datum von (ISO 8601)
- `bis` – Datum bis (ISO 8601)
- `seite`, `pro_seite`

**Response 200:**
```json
{
  "erfolg": true,
  "daten": {
    "eintraege": [
      {
        "id": "uuid",
        "vorname": "Anna",
        "nachname": "Mustermann",
        "email": "anna@example.de",
        "telefon": "+49151234567",
        "status": "Neu",
        "quelle": "facebook_lead_ads",
        "ist_duplikat": false,
        "erstellt_am": "2026-03-30T08:30:00Z",
        "felder": {
          "pferd_rasse": "Hannoveraner",
          "anzahl_pferde": "2"
        }
      }
    ],
    "gesamt": 247
  }
}
```

---

### GET /leads/:id
Vollständiges Lead-Profil mit Aktivitätslog.

**Response 200:**
```json
{
  "erfolg": true,
  "daten": {
    "id": "uuid",
    "vorname": "Anna",
    "nachname": "Mustermann",
    "email": "anna@example.de",
    "telefon": "+49151234567",
    "status": "In Bearbeitung",
    "zugewiesen_an": {
      "id": "uuid",
      "name": "Lisa Müller"
    },
    "felder": { "pferd_rasse": "Hannoveraner" },
    "notizen": [
      {
        "id": "uuid",
        "inhalt": "Hat Interesse bekundet",
        "autor": "Lisa Müller",
        "erstellt_am": "2026-03-30T10:00:00Z"
      }
    ],
    "status_historie": [
      { "alter_status": null, "neuer_status": "Neu", "erstellt_am": "..." },
      { "alter_status": "Neu", "neuer_status": "In Bearbeitung", "erstellt_am": "..." }
    ],
    "aktivitaeten": [
      {
        "typ": "lead_erstellt",
        "beschreibung": "Lead via Facebook Lead Ads erstellt",
        "erstellt_am": "2026-03-30T08:30:00Z"
      }
    ]
  }
}
```

---

### PATCH /leads/:id
Lead-Status oder Zuweisung aktualisieren.

**Request:**
```json
{
  "status": "Termin gebucht",
  "zugewiesen_an": "benutzer-uuid"
}
```

---

### POST /leads/:id/notizen
Notiz zu Lead hinzufügen.

**Request:**
```json
{ "inhalt": "Kunde hat zurückgerufen und Termin vereinbart." }
```

---

### GET /leads/export
Leads als CSV exportieren.

**Query-Parameter:** Gleiche Filter wie GET /leads  
**Response:** `Content-Type: text/csv`

---

## 4. Automatisierungen

### GET /kampagnen/:kampagne_id/automatisierungen
Alle Automatisierungen einer Kampagne.

**Response 200:**
```json
{
  "erfolg": true,
  "daten": [
    {
      "id": "uuid",
      "name": "E-Mail bei Nicht erreichbar",
      "aktiv": true,
      "trigger_typ": "status_geaendert",
      "trigger_konfiguration": { "zu_status": "Nicht erreichbar" },
      "schritte": [
        {
          "reihenfolge": 1,
          "aktion_typ": "warten",
          "konfiguration": { "minuten": 30 }
        },
        {
          "reihenfolge": 2,
          "aktion_typ": "email_senden",
          "konfiguration": { "template_id": "uuid" }
        }
      ]
    }
  ]
}
```

---

### POST /kampagnen/:kampagne_id/automatisierungen
Neue Automatisierung erstellen.

**Request:**
```json
{
  "name": "Follow-up E-Mail",
  "trigger_typ": "status_geaendert",
  "trigger_konfiguration": { "zu_status": "Nicht erreichbar" },
  "bedingungen": [
    { "feld": "quelle", "operator": "gleich", "wert": "facebook_lead_ads" }
  ],
  "schritte": [
    { "reihenfolge": 1, "aktion_typ": "warten", "konfiguration": { "minuten": 30 } },
    {
      "reihenfolge": 2,
      "aktion_typ": "email_senden",
      "konfiguration": {
        "template_id": "uuid",
        "zeitfenster": { "von": "09:00", "bis": "20:00", "wochentage": [1,2,3,4,5] }
      }
    },
    {
      "reihenfolge": 3,
      "aktion_typ": "whatsapp_senden",
      "konfiguration": { "template_id": "superchat-template-id", "kanal_id": "kanal-id" }
    }
  ]
}
```

---

### PATCH /automatisierungen/:id
Automatisierung aktivieren/deaktivieren oder aktualisieren.

### DELETE /automatisierungen/:id
Automatisierung löschen.

---

## 5. Webhooks (Eingang)

### POST /webhooks/:kampagne_slug
Generischer Webhook-Endpunkt für Lead-Eingang.

**Header:** `X-Axano-Signatur: sha256=<hmac>`  
**Request:** Beliebiger JSON-Body

---

### POST /webhooks/facebook/verify
Facebook Webhook-Verifikation (GET).

### POST /webhooks/facebook/:kampagne_slug
Facebook Lead Ads Webhook.

**Header:** `X-Hub-Signature-256: sha256=<hmac>`

---

### POST /webhooks/calendly
Calendly Terminbuchungs-Webhook.

**Header:** `Calendly-Webhook-Signature: ...`

---

## 6. Analytics

### GET /analytics/uebersicht
Plattform-weite KPIs.

**Response 200:**
```json
{
  "erfolg": true,
  "daten": {
    "gesamt_leads": 1247,
    "leads_heute": 34,
    "leads_diese_woche": 189,
    "aktive_kampagnen": 5,
    "conversion_rate_gesamt": 14.2
  }
}
```

---

### GET /analytics/kampagnen/:id
Detaillierte Analytics für eine Kampagne.

**Query-Parameter:**
- `zeitraum` – `heute` | `woche` | `monat` | `quartal`

**Response 200:**
```json
{
  "erfolg": true,
  "daten": {
    "leads_zeitreihe": [
      { "datum": "2026-03-29", "anzahl": 12 },
      { "datum": "2026-03-30", "anzahl": 8 }
    ],
    "status_verteilung": {
      "Neu": 45,
      "In Bearbeitung": 23,
      "Termin gebucht": 34,
      "Nicht erreichbar": 58,
      "Nicht interessiert": 12
    },
    "automatisierungen": {
      "emails_gesendet": 189,
      "whatsapp_gesendet": 134
    }
  }
}
```

---

## 7. Standardisierte Fehlerformate

```json
{
  "erfolg": false,
  "fehler": "Kurze Fehlerbeschreibung",
  "details": [
    { "feld": "email", "nachricht": "Ungültige E-Mail-Adresse" }
  ],
  "code": "VALIDIERUNGSFEHLER"
}
```

**HTTP-Statuscodes:**

| Code | Bedeutung |
|------|-----------|
| 200 | Erfolgreich |
| 201 | Erstellt |
| 400 | Ungültige Anfrage |
| 401 | Nicht authentifiziert |
| 403 | Nicht autorisiert |
| 404 | Nicht gefunden |
| 409 | Konflikt (z.B. Duplikat) |
| 429 | Rate Limit überschritten |
| 500 | Interner Serverfehler |

---

## 8. Rate Limiting

| Endpunkt | Limit |
|----------|-------|
| POST /auth/anmelden | 5 Anfragen / 15 Min pro IP |
| Alle anderen | 100 Anfragen / Min pro Benutzer |
| Webhooks (eingehend) | 1000 Anfragen / Min pro Kampagne |

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
