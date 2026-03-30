# CLAUDE_CODE_PROMPT – Masterfile für die Entwicklung
## Axano LeadFlow Plattform
**Dieses Dokument ist der vollständige Kontext-Prompt für Claude Code**

---

## PROJEKTÜBERSICHT

Du entwickelst **Axano LeadFlow** – eine interne Lead-Management-Plattform für die Axano GmbH (KI-Agentur). Die Plattform ersetzt einen bestehenden n8n-Workflow mit 270 Nodes und bietet eine moderne, webbasierte Oberfläche zur Verwaltung von Marketing-Leads aus verschiedenen Quellen.

**Wichtige Grundregeln:**
- Alle Variablennamen, Kommentare, Funktionsnamen und UI-Texte auf **Deutsch**
- Ausnahmen: Standard-npm-Paketnamen, HTTP-Methoden (GET, POST etc.), SQL-Schlüsselwörter
- Sprache: **TypeScript** überall (Frontend + Backend)
- Kein `any` in TypeScript – immer explizite Typen
- Alle Datenbankoperationen über **Prisma ORM**
- Fehlerbehandlung immer mit try/catch und aussagekräftigen deutschen Fehlermeldungen

---

## TECHNOLOGIE-STACK

### Frontend
```
Framework:      Next.js 14 (App Router)
Sprache:        TypeScript 5
Styling:        Tailwind CSS 3 + shadcn/ui
Schriftart:     Manrope (Google Fonts)
Zustand:        Zustand 4
Datenabruf:     TanStack Query 5
Echtzeit:       Socket.IO Client 4
Formulare:      React Hook Form + Zod
Drag & Drop:    @dnd-kit/core
Diagramme:      Recharts
Icons:          lucide-react
Rich-Text:      Tiptap
```

### Backend
```
Runtime:        Node.js 20 LTS
Framework:      Express.js 4 + TypeScript
ORM:            Prisma 5
Auth:           JWT (jsonwebtoken) + bcrypt
WebSocket:      Socket.IO 4
Job-Queue:      BullMQ (Redis)
Validierung:    Zod
E-Mail:         Nodemailer
Logging:        Winston (JSON-Format)
```

### Infrastruktur
```
Datenbank:      PostgreSQL 15
Cache/Queue:    Redis 7
Container:      Docker + Docker Compose
Webserver:      Nginx (Reverse Proxy)
```

---

## AXANO CORPORATE DESIGN

```css
/* Primärfarben */
--axano-primaer:      #1a2b4c   /* Dunkelblau */
--axano-sekundaer:    #2f3542   /* Graphit-Blau */
--axano-graphit:      #3f4e65   /* Graphit */
--axano-sky-blue:     #c7d7e8   /* Hellblau */
--axano-soft-cloud:   #f5f7fa   /* Fast Weiß */
--axano-orange:       #ff8049   /* Orange CTA */

/* Schriftart */
Manrope (200, 300, 400, 500, 600, 700, 800)

/* Dark Mode: Hintergrund #0f1623, Oberfläche #1a2435 */
```

**UI-Prinzipien:**
- Seitenleiste: `bg-axano-primaer` (#1a2b4c) mit weißer Schrift
- Hintergrund: `bg-axano-soft-cloud` (#f5f7fa)
- CTAs und Highlights: `bg-axano-orange` (#ff8049)
- Karten: Weiß mit `border-axano-sky-blue/50`
- Alle Ecken: `rounded-xl` (12px) für Karten, `rounded-lg` (8px) für Buttons/Inputs

---

## DATENBANKSCHEMA (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATENBANK_URL")
}

model Benutzer {
  id              String    @id @default(uuid())
  email           String    @unique
  passwortHash    String    @map("passwort_hash")
  vorname         String
  nachname        String
  rolle           Rolle     @default(mitarbeiter)
  aktiv           Boolean   @default(true)
  letzterLogin    DateTime? @map("letzter_login")
  loginVersuche   Int       @default(0) @map("login_versuche")
  gesperrtBis     DateTime? @map("gesperrt_bis")
  erstelltAm      DateTime  @default(now()) @map("erstellt_am")
  aktualisiertAm  DateTime  @updatedAt @map("aktualisiert_am")
  kampagnen       Kampagne[]
  leads           Lead[]    @relation("ZugewiesenAn")
  notizen         LeadNotiz[]
  @@map("benutzer")
}

enum Rolle {
  admin
  mitarbeiter
}

model Kampagne {
  id                    String    @id @default(uuid())
  name                  String
  beschreibung          String?
  status                KampagnenStatus @default(aktiv)
  triggerTyp            TriggerTyp @map("trigger_typ")
  triggerKonfiguration  Json      @default("{}") @map("trigger_konfiguration")
  webhookSlug           String?   @unique @map("webhook_slug")
  pipelineSpalten       Json      @default("[\"Neu\",\"In Bearbeitung\",\"Follow-up\",\"Nicht erreichbar\",\"Termin gebucht\",\"Nicht interessiert\"]") @map("pipeline_spalten")
  erstelltVon           String?   @map("erstellt_von")
  ersteller             Benutzer? @relation(fields: [erstelltVon], references: [id])
  erstelltAm            DateTime  @default(now()) @map("erstellt_am")
  aktualisiertAm        DateTime  @updatedAt @map("aktualisiert_am")
  felder                KampagnenFeld[]
  leads                 Lead[]
  automatisierungen     Automatisierung[]
  @@map("kampagnen")
}

enum KampagnenStatus { aktiv pausiert archiviert }
enum TriggerTyp { facebook_lead_ads webhook email whatsapp webformular }

model KampagnenFeld {
  id          String      @id @default(uuid())
  kampagneId  String      @map("kampagne_id")
  kampagne    Kampagne    @relation(fields: [kampagneId], references: [id], onDelete: Cascade)
  feldname    String
  bezeichnung String
  feldtyp     FeldTyp
  pflichtfeld Boolean     @default(false)
  optionen    Json?
  reihenfolge Int         @default(0)
  platzhalter String?
  hilfetext   String?
  erstelltAm  DateTime    @default(now()) @map("erstellt_am")
  felddaten   LeadFelddatum[]
  @@unique([kampagneId, feldname])
  @@map("kampagnen_felder")
}

enum FeldTyp { text zahl email telefon datum auswahl ja_nein mehrzeilig }

model Lead {
  id              String    @id @default(uuid())
  kampagneId      String    @map("kampagne_id")
  kampagne        Kampagne  @relation(fields: [kampagneId], references: [id])
  zugewiesenAn    String?   @map("zugewiesen_an")
  zugewiesener    Benutzer? @relation("ZugewiesenAn", fields: [zugewiesenAn], references: [id])
  vorname         String?
  nachname        String?
  email           String?
  telefon         String?
  status          String    @default("Neu")
  quelle          String?
  duplikatVon     String?   @map("duplikat_von")
  istDuplikat     Boolean   @default(false) @map("ist_duplikat")
  geloescht       Boolean   @default(false)
  geloeschtAm     DateTime? @map("geloescht_am")
  rohdaten        Json?
  erstelltAm      DateTime  @default(now()) @map("erstellt_am")
  aktualisiertAm  DateTime  @updatedAt @map("aktualisiert_am")
  felddaten       LeadFelddatum[]
  statusHistorie  LeadStatusHistorie[]
  notizen         LeadNotiz[]
  aktivitaeten    LeadAktivitaet[]
  termine         Termin[]
  @@map("leads")
}

model LeadFelddatum {
  id          String        @id @default(uuid())
  leadId      String        @map("lead_id")
  lead        Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  feldId      String        @map("feld_id")
  feld        KampagnenFeld @relation(fields: [feldId], references: [id])
  wert        String?
  erstelltAm  DateTime      @default(now()) @map("erstellt_am")
  @@unique([leadId, feldId])
  @@map("lead_felddaten")
}

model LeadStatusHistorie {
  id            String    @id @default(uuid())
  leadId        String    @map("lead_id")
  lead          Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  alterStatus   String?   @map("alter_status")
  neuerStatus   String    @map("neuer_status")
  geaendertVon  String?   @map("geaendert_von")
  grund         String?
  erstelltAm    DateTime  @default(now()) @map("erstellt_am")
  @@map("lead_status_historie")
}

model LeadNotiz {
  id          String    @id @default(uuid())
  leadId      String    @map("lead_id")
  lead        Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  autorId     String?   @map("autor_id")
  autor       Benutzer? @relation(fields: [autorId], references: [id])
  inhalt      String
  erstelltAm  DateTime  @default(now()) @map("erstellt_am")
  bearbeitetAm DateTime? @map("bearbeitet_am")
  @@map("lead_notizen")
}

model LeadAktivitaet {
  id            String    @id @default(uuid())
  leadId        String    @map("lead_id")
  lead          Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  typ           AktivitaetTyp
  beschreibung  String
  metadaten     Json?
  benutzerId    String?   @map("benutzer_id")
  erstelltAm    DateTime  @default(now()) @map("erstellt_am")
  @@map("lead_aktivitaeten")
}

enum AktivitaetTyp {
  lead_erstellt
  status_geaendert
  notiz_hinzugefuegt
  email_gesendet
  whatsapp_gesendet
  termin_gebucht
  automatisierung_ausgefuehrt
  fehler
  manuell
}

model Automatisierung {
  id                    String    @id @default(uuid())
  kampagneId            String    @map("kampagne_id")
  kampagne              Kampagne  @relation(fields: [kampagneId], references: [id], onDelete: Cascade)
  name                  String
  beschreibung          String?
  aktiv                 Boolean   @default(true)
  triggerTyp            AutoTriggerTyp @map("trigger_typ")
  triggerKonfiguration  Json      @default("{}") @map("trigger_konfiguration")
  bedingungen           Json      @default("[]")
  reihenfolge           Int       @default(0)
  erstelltAm            DateTime  @default(now()) @map("erstellt_am")
  aktualisiertAm        DateTime  @updatedAt @map("aktualisiert_am")
  schritte              AutomatisierungsSchritt[]
  ausfuehrungen         AutomatisierungsAusfuehrung[]
  @@map("automatisierungen")
}

enum AutoTriggerTyp { lead_eingetroffen status_geaendert inaktivitaet zeitplan }

model AutomatisierungsSchritt {
  id                String        @id @default(uuid())
  automatisierungId String        @map("automatisierung_id")
  automatisierung   Automatisierung @relation(fields: [automatisierungId], references: [id], onDelete: Cascade)
  reihenfolge       Int
  aktionTyp         AktionTyp     @map("aktion_typ")
  konfiguration     Json          @default("{}")
  erstelltAm        DateTime      @default(now()) @map("erstellt_am")
  @@map("automatisierungs_schritte")
}

enum AktionTyp { email_senden whatsapp_senden status_setzen benachrichtigung warten warten_bis_uhrzeit }

model AutomatisierungsAusfuehrung {
  id                  String    @id @default(uuid())
  automatisierungId   String    @map("automatisierung_id")
  automatisierung     Automatisierung @relation(fields: [automatisierungId], references: [id])
  leadId              String    @map("lead_id")
  status              AusfuehrungsStatus @default(laeuft)
  aktuellerSchritt    Int       @default(0) @map("aktueller_schritt")
  naechsteAusfuehrung DateTime? @map("naechste_ausfuehrung")
  fehlerNachricht     String?   @map("fehler_nachricht")
  erstelltAm          DateTime  @default(now()) @map("erstellt_am")
  abgeschlossenAm     DateTime? @map("abgeschlossen_am")
  @@map("automatisierungs_ausfuehrungen")
}

enum AusfuehrungsStatus { laeuft abgeschlossen fehler abgebrochen }

model EmailTemplate {
  id            String    @id @default(uuid())
  name          String
  betreff       String
  htmlInhalt    String    @map("html_inhalt")
  textInhalt    String?   @map("text_inhalt")
  variablen     Json      @default("[]")
  version       Int       @default(1)
  erstelltVon   String?   @map("erstellt_von")
  erstelltAm    DateTime  @default(now()) @map("erstellt_am")
  aktualisiertAm DateTime @updatedAt @map("aktualisiert_am")
  @@map("email_templates")
}

model Termin {
  id          String    @id @default(uuid())
  leadId      String?   @map("lead_id")
  lead        Lead?     @relation(fields: [leadId], references: [id], onDelete: SetNull)
  kampagneId  String?   @map("kampagne_id")
  titel       String
  beschreibung String?
  beginnAm    DateTime  @map("beginn_am")
  endeAm      DateTime? @map("ende_am")
  quelle      TerminQuelle?
  externeId   String?   @map("externe_id")
  teilnehmer  Json?
  erstelltAm  DateTime  @default(now()) @map("erstellt_am")
  @@map("termine")
}

enum TerminQuelle { calendly google_calendar manuell }
```

---

## API-KONVENTIONEN

### Antwortformat (immer einheitlich)
```typescript
// Erfolg
{ erfolg: true, daten: { ... } }
{ erfolg: true, daten: { eintraege: [...], gesamt: 100, seite: 1 } }

// Fehler
{ erfolg: false, fehler: 'Beschreibung', details: [...], code: 'FEHLERCODE' }
```

### Middleware-Stack (Reihenfolge)
```typescript
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.use(morganLogging);
app.use(rateLimiting);
// Routen...
app.use(globaleFehlerbehebung);
```

### Authentifizierungs-Middleware
```typescript
// Alle geschützten Routen:
router.use(authentifizierung); // Prüft JWT Bearer Token

// Nur Admin:
router.post('/benutzer', authentifizierung, nurAdmin, benutzerErstellen);
```

---

## ENTWICKLUNGSREIHENFOLGE (Phase 1 zuerst)

**Starte immer mit Phase 1 – Fundament:**

1. `docker-compose.yml` erstellen
2. Backend-Grundstruktur (`apps/backend/src/app.ts`)
3. Prisma-Schema und erste Migration
4. Auth-Routen implementieren
5. Frontend-Grundstruktur mit Next.js
6. Anmelde-Seite im Axano-Design
7. Layout mit Seitenleiste

**Dann Phase 2 – Kampagnen & Leads:**

8. Kampagnen-CRUD API
9. Webhook-Eingang
10. Lead-Normalisierung
11. Kanban-Board

---

## CODEQUALITÄT-ANFORDERUNGEN

```typescript
// ✅ Richtig – Explizite Typen, deutsche Bezeichnungen
interface LeadEingangDaten {
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  kampagneId: string;
  rohdaten: Record<string, unknown>;
}

async function leadNormalisieren(rohdaten: Record<string, unknown>): Promise<LeadEingangDaten> {
  // Telefonnummer in deutsches Format konvertieren
  const telefon = rohTelefon
    .replace(/\s+/g, '')
    .replace(/^0/, '+49')
    .replace(/^\+490/, '+49');
  
  return { vorname, nachname, email, telefon, ... };
}

// ❌ Falsch – any, englische Namen
async function processLead(data: any) { ... }
```

---

## WICHTIGE HINWEISE

1. **Webhook-Sicherheit:** Jeden eingehenden Webhook mit HMAC-SHA256 verifizieren
2. **API-Schlüssel:** Immer mit AES-256-GCM verschlüsselt in der DB speichern
3. **Telefonnummern:** Immer automatisch in +49-Format normalisieren
4. **Zeitfenster:** Vor jedem E-Mail/WhatsApp-Versand prüfen (Mo-Fr 09:00-20:00 Standard)
5. **Duplikate:** Bei jedem Lead-Eingang prüfen (gleiche E-Mail ODER Telefon in gleicher Kampagne)
6. **Aktivitätslog:** Jede relevante Aktion protokollieren (inkl. Automatisierungsschritte)
7. **Dark Mode:** Alle Komponenten müssen in Light UND Dark Mode funktionieren
8. **Fehlerbehandlung:** Immer try/catch, nie unbehandelte Promise-Rejections

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
*Dieses Dokument enthält den vollständigen Kontext für die Entwicklung mit Claude Code*
