# ARCHITEKTUR – Technische Systemarchitektur
## Axano LeadFlow Plattform
**Version:** 1.0.0  
**Stand:** März 2026

---

## 1. Technologie-Stack

### 1.1 Frontend
| Komponente | Technologie | Version | Begründung |
|------------|-------------|---------|------------|
| Framework | Next.js (App Router) | 14+ | SSR, API-Routes, optimale Performance |
| Sprache | TypeScript | 5+ | Typsicherheit, bessere Entwicklererfahrung |
| Styling | Tailwind CSS | 3+ | Schnelle Entwicklung, konsistentes Design |
| Komponenten | shadcn/ui | aktuell | Zugängliche, anpassbare Komponenten |
| Schriftart | Manrope | – | Axano Corporate Design |
| Zustandsverwaltung | Zustand | 4+ | Leichtgewichtig, einfach |
| Datenabruf | TanStack Query | 5+ | Caching, automatische Neuabfragen |
| Echtzeit | Socket.IO Client | 4+ | WebSocket-Verbindung für Live-Updates |
| Formulare | React Hook Form + Zod | – | Validierung, Performance |
| Drag & Drop | @dnd-kit | – | Kanban-Board, Feldsortierer |
| Diagramme | Recharts | – | Analytics-Dashboard |
| Rich-Text | Tiptap | – | E-Mail-Template-Editor |

### 1.2 Backend
| Komponente | Technologie | Version | Begründung |
|------------|-------------|---------|------------|
| Runtime | Node.js | 20 LTS | Stabil, breite Unterstützung |
| Framework | Express.js | 4+ | Leichtgewichtig, flexibel |
| Sprache | TypeScript | 5+ | Typsicherheit |
| ORM | Prisma | 5+ | Typsichere DB-Abfragen, Migrationen |
| Authentifizierung | JWT + bcrypt | – | Sicher, stateless |
| WebSocket | Socket.IO | 4+ | Echtzeit-Kommunikation |
| Job-Queue | BullMQ | – | Redis-basiert, zuverlässig |
| Validierung | Zod | – | Konsistente Validierung mit Frontend |
| E-Mail | Nodemailer | – | SMTP-Versand |
| Kryptografie | Node Crypto | – | AES-256 für API-Schlüssel |

### 1.3 Infrastruktur
| Komponente | Technologie | Begründung |
|------------|-------------|------------|
| Datenbank | PostgreSQL 15+ | Bewährt, JSONB-Unterstützung |
| Cache / Queue | Redis 7+ | BullMQ-Backend, Session-Cache |
| Container | Docker + Docker Compose | Reproduzierbare Umgebung |
| Webserver | Nginx | Reverse Proxy, SSL-Terminierung |
| SSL | Let's Encrypt / Certbot | Kostenlos, automatische Erneuerung |
| Deployment | VPS (Ubuntu 22.04 LTS) | Volle Kontrolle, kosteneffizient |

---

## 2. Systemarchitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET / EXTERNE DIENSTE               │
│   Facebook API    Superchat API    Calendly    Google Calendar   │
└────────────┬─────────────┬──────────┬──────────────┬────────────┘
             │             │          │              │
             ▼             ▼          ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX (Port 443)                        │
│              SSL-Terminierung + Reverse Proxy                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌──────────────────┐             ┌──────────────────────┐
│   Next.js        │             │   Express.js API     │
│   Frontend       │◄────────────│   Backend            │
│   Port: 3000     │  REST/WS    │   Port: 4000         │
└──────────────────┘             └──────┬───────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
          ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐
          │  PostgreSQL     │  │    Redis     │  │   BullMQ       │
          │  Port: 5432     │  │  Port: 6379  │  │   Job Queue    │
          └─────────────────┘  └──────────────┘  └────────────────┘
```

---

## 3. Projektstruktur

```
axano-leadflow/
├── apps/
│   ├── frontend/                    # Next.js App
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── anmelden/
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── kampagnen/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── leads/
│   │   │   │   │   │   ├── automatisierungen/
│   │   │   │   │   │   └── einstellungen/
│   │   │   │   │   └── neu/
│   │   │   │   ├── leads/
│   │   │   │   ├── templates/
│   │   │   │   ├── analytics/
│   │   │   │   ├── kalender/
│   │   │   │   └── einstellungen/
│   │   │   │       ├── integrationen/
│   │   │   │       ├── benutzer/
│   │   │   │       └── profil/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui Basiskomponenten
│   │   │   ├── layout/
│   │   │   │   ├── seitenleiste.tsx
│   │   │   │   ├── kopfzeile.tsx
│   │   │   │   └── navigation.tsx
│   │   │   ├── leads/
│   │   │   │   ├── kanban-board.tsx
│   │   │   │   ├── lead-karte.tsx
│   │   │   │   ├── lead-detail.tsx
│   │   │   │   └── lead-formular.tsx
│   │   │   ├── kampagnen/
│   │   │   │   ├── kampagnen-wizard.tsx
│   │   │   │   ├── trigger-auswahl.tsx
│   │   │   │   ├── felder-builder.tsx
│   │   │   │   └── kampagnen-karte.tsx
│   │   │   ├── automatisierungen/
│   │   │   │   ├── automatisierungs-editor.tsx
│   │   │   │   └── schritt-karte.tsx
│   │   │   └── analytics/
│   │   │       ├── kpi-karten.tsx
│   │   │       └── diagramme.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts
│   │   │   ├── socket-client.ts
│   │   │   ├── hilfsfunktionen.ts
│   │   │   └── typen.ts
│   │   ├── hooks/
│   │   │   ├── benutze-leads.ts
│   │   │   ├── benutze-kampagnen.ts
│   │   │   └── benutze-echtzeit.ts
│   │   └── stores/
│   │       ├── auth-store.ts
│   │       └── ui-store.ts
│   │
│   └── backend/                     # Express.js API
│       ├── src/
│       │   ├── routen/
│       │   │   ├── auth.routen.ts
│       │   │   ├── benutzer.routen.ts
│       │   │   ├── kampagnen.routen.ts
│       │   │   ├── leads.routen.ts
│       │   │   ├── automatisierungen.routen.ts
│       │   │   ├── templates.routen.ts
│       │   │   ├── termine.routen.ts
│       │   │   ├── analytics.routen.ts
│       │   │   ├── webhooks.routen.ts
│       │   │   └── integrationen.routen.ts
│       │   ├── middleware/
│       │   │   ├── authentifizierung.ts
│       │   │   ├── autorisierung.ts
│       │   │   ├── validierung.ts
│       │   │   ├── rate-limiting.ts
│       │   │   └── fehlerbehandlung.ts
│       │   ├── dienste/
│       │   │   ├── lead.dienst.ts
│       │   │   ├── kampagnen.dienst.ts
│       │   │   ├── automatisierung.dienst.ts
│       │   │   ├── email.dienst.ts
│       │   │   ├── whatsapp.dienst.ts
│       │   │   ├── facebook.dienst.ts
│       │   │   ├── kalender.dienst.ts
│       │   │   └── benachrichtigung.dienst.ts
│       │   ├── jobs/
│       │   │   ├── job-verarbeiter.ts
│       │   │   ├── automatisierung.job.ts
│       │   │   ├── email.job.ts
│       │   │   └── webhook.job.ts
│       │   ├── websocket/
│       │   │   └── socket.handler.ts
│       │   ├── datenbank/
│       │   │   └── prisma.client.ts
│       │   ├── hilfsfunktionen/
│       │   │   ├── telefon.formatierung.ts
│       │   │   ├── verschluesselung.ts
│       │   │   └── webhook.verifikation.ts
│       │   └── app.ts
│       └── prisma/
│           ├── schema.prisma
│           └── migrationen/
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx.conf
└── .env.beispiel
```

---

## 4. Datenflussbeschreibung

### 4.1 Lead-Eingang (Facebook Lead Ads)

```
1. Facebook sendet Webhook an /api/v1/webhooks/facebook/{kampagne_slug}
2. HMAC-Signatur wird verifiziert (x-hub-signature-256)
3. Rohdaten werden in system_logs gespeichert
4. Lead-Normalisierung:
   - Telefon → +49-Format
   - Felder → kampagnenspezifische Felder gemappt
5. Duplikatsprüfung (E-Mail + Telefon innerhalb Kampagne)
6. Lead wird in PostgreSQL gespeichert (leads + lead_felddaten)
7. Status-Historie wird erstellt (Ersteintrag: "Neu")
8. Aktivitätslog: "Lead erstellt via Facebook Lead Ads"
9. WebSocket-Event an alle verbundenen Clients: "lead:neu"
10. Automatisierungen für Trigger "lead_eingetroffen" werden gestartet
11. Job in job_queue erstellt für asynchrone Verarbeitung
```

### 4.2 Automatisierungsausführung

```
1. Job-Worker prüft job_queue alle 5 Sekunden
2. Automatisierungs-Schritte werden sequenziell abgearbeitet:
   a. email_senden → email.dienst.ts → SMTP
   b. whatsapp_senden → whatsapp.dienst.ts → Superchat API
   c. status_setzen → lead.dienst.ts → PostgreSQL
   d. warten → Job wird mit naechster_versuch = NOW() + Wartezeit neu eingeplant
   e. warten_bis_uhrzeit → Zeitfensterprüfung (Mo-Fr 09:00-20:00)
3. Nach jedem Schritt: Aktivitätslog-Eintrag
4. Bei Fehler: max. 3 Wiederholungsversuche (exponentielles Backoff)
5. Bei kritischem Fehler: Admin-Benachrichtigung per E-Mail
```

---

## 5. Sicherheitsarchitektur

### 5.1 Authentifizierungsfluss

```
Anmeldung:
POST /api/v1/auth/anmelden
→ bcrypt-Passwortprüfung
→ Access Token (JWT, 8h) + Refresh Token (JWT, 30d) ausgeben
→ Refresh Token als httpOnly Cookie setzen

Token-Erneuerung:
POST /api/v1/auth/token-erneuern
→ Refresh Token aus Cookie lesen
→ Widerrufs-Check in refresh_tokens-Tabelle
→ Neue Token ausgeben

Abmeldung:
POST /api/v1/auth/abmelden
→ Refresh Token in DB als widerrufen markieren
→ Cookie löschen
```

### 5.2 API-Schlüssel-Verschlüsselung

```typescript
// Alle Integrations-API-Schlüssel werden mit AES-256-GCM verschlüsselt
const VERSCHLUESSELUNGS_SCHLUESSEL = process.env.VERSCHLUESSELUNGS_SCHLUESSEL; // 32 Bytes

function verschluesseln(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', VERSCHLUESSELUNGS_SCHLUESSEL, iv);
    const verschluesselt = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const auth_tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${auth_tag.toString('hex')}:${verschluesselt.toString('hex')}`;
}
```

---

## 6. Umgebungsvariablen

```bash
# .env.beispiel

# Datenbank
DATENBANK_URL="postgresql://benutzer:passwort@localhost:5432/axano_leadflow"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_GEHEIMNIS="mindestens-32-zeichen-langes-geheimnis"
JWT_ABLAUF="8h"
REFRESH_TOKEN_GEHEIMNIS="anderes-langes-geheimnis"
REFRESH_TOKEN_ABLAUF="30d"

# Verschlüsselung
VERSCHLUESSELUNGS_SCHLUESSEL="32-byte-hex-schluessel"

# SMTP (Standard)
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_BENUTZER="noreply@axano.de"
SMTP_PASSWORT="passwort"
SMTP_ABSENDER_NAME="Axano LeadFlow"

# Facebook
FACEBOOK_APP_ID="123456789"
FACEBOOK_APP_GEHEIMNIS="geheimnis"
FACEBOOK_VERIFY_TOKEN="webhook-verify-token"

# Superchat (WhatsApp)
SUPERCHAT_API_URL="https://api.superchat.de"

# Google
GOOGLE_CLIENT_ID="client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_GEHEIMNIS="geheimnis"

# Calendly
CALENDLY_WEBHOOK_SIGNING_KEY="signing-key"

# App
NODE_ENV="production"
PORT=4000
FRONTEND_URL="https://leadflow.axano.de"
API_URL="https://leadflow.axano.de/api"

# Admin-Benachrichtigung
ADMIN_EMAIL="admin@axano.de"
```

---

## 7. Docker-Konfiguration

```yaml
# docker-compose.yml (Entwicklung)
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: axano_leadflow
      POSTGRES_USER: axano
      POSTGRES_PASSWORD: ${DB_PASSWORT}
    volumes:
      - postgres_daten:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_daten:/data

  backend:
    build: ./apps/backend
    ports:
      - "4000:4000"
    environment:
      - DATENBANK_URL=postgresql://axano:${DB_PASSWORT}@postgres:5432/axano_leadflow
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./apps/backend:/app
      - /app/node_modules

  frontend:
    build: ./apps/frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:4000
    depends_on:
      - backend

volumes:
  postgres_daten:
  redis_daten:
```

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
