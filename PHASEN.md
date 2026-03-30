# PHASEN – Entwicklungsplan
## Axano LeadFlow Plattform
**Version:** 1.0.0  
**Stand:** März 2026  
**Gesamtdauer:** ca. 12–14 Wochen

---

## Übersicht

```
Phase 1: Fundament          (Woche 1–2)   ████████
Phase 2: Lead-Kern          (Woche 3–5)   ████████████
Phase 3: Automatisierungen  (Woche 6–8)   ████████████
Phase 4: Integrationen      (Woche 9–10)  ████████
Phase 5: Analytics & UI     (Woche 11–12) ████████
Phase 6: Testing & Deployment (Woche 13–14) ████████
```

---

## Phase 1: Fundament & Infrastruktur
**Dauer:** 2 Wochen  
**Priorität:** Kritisch – alle weiteren Phasen bauen darauf auf

### 1.1 Entwicklungsumgebung
- [ ] Monorepo-Struktur aufsetzen (apps/frontend, apps/backend)
- [ ] Docker Compose für lokale Entwicklung konfigurieren
- [ ] PostgreSQL 15 + Redis 7 Container einrichten
- [ ] Umgebungsvariablen-Verwaltung (.env, .env.example)
- [ ] Git-Repository + Branch-Strategie (main, develop, feature/*)
- [ ] ESLint + Prettier konfigurieren
- [ ] TypeScript-Konfiguration für beide Apps

### 1.2 Datenbank
- [ ] Prisma ORM einrichten und mit PostgreSQL verbinden
- [ ] Alle Migrations-Dateien erstellen (001 bis 022)
- [ ] Datenbankfunktionen und Trigger implementieren
- [ ] Views erstellen
- [ ] Seed-Daten für Entwicklung

### 1.3 Backend-Grundstruktur
- [ ] Express.js App mit TypeScript aufsetzen
- [ ] Middleware-Stack: CORS, Helmet, Morgan, Rate Limiting
- [ ] Fehlerbehandlungs-Middleware (globaler Error Handler)
- [ ] Health-Check-Endpunkt: `GET /api/v1/health`
- [ ] Strukturiertes Logging (Winston, JSON-Format)
- [ ] BullMQ Job-Queue mit Redis verbinden
- [ ] Basis-Antwortformat standardisieren

### 1.4 Authentifizierung
- [ ] POST /api/v1/auth/anmelden
- [ ] POST /api/v1/auth/token-erneuern
- [ ] POST /api/v1/auth/abmelden
- [ ] JWT-Middleware für geschützte Routen
- [ ] Rollen-Middleware (admin, mitarbeiter)
- [ ] Login-Sperrung nach 5 Fehlversuchen
- [ ] Ersten Admin-Benutzer per Seed erstellen

### 1.5 Frontend-Grundstruktur
- [ ] Next.js 14 mit App Router und TypeScript aufsetzen
- [ ] Tailwind CSS + shadcn/ui installieren und konfigurieren
- [ ] Manrope-Schriftart einbinden (Google Fonts)
- [ ] Axano Farbpalette als CSS-Variablen definieren
- [ ] Anmelde-Seite (Design nach Corporate Design)
- [ ] Auth-Store mit Zustand
- [ ] API-Client (Axios + Interceptors für Token-Erneuerung)
- [ ] Geschützte Routen + Redirect-Logik
- [ ] Layout: Seitenleiste + Kopfzeile + Hauptbereich

**Akzeptanzkriterien Phase 1:**
- Entwickler kann sich anmelden und abmelden
- JWT-Token werden korrekt ausgestellt und erneuert
- Datenbankmigrationen laufen fehlerfrei durch
- Health-Check gibt Status 200 zurück
- Docker Compose startet alle Services

---

## Phase 2: Kampagnen & Lead-Kern
**Dauer:** 3 Wochen  
**Priorität:** Kritisch – Kernfunktionalität der Plattform

### 2.1 Kampagnenverwaltung Backend
- [ ] GET /kampagnen – Liste mit Statistiken
- [ ] POST /kampagnen – Neue Kampagne erstellen
- [ ] GET /kampagnen/:id – Einzelne Kampagne
- [ ] PATCH /kampagnen/:id – Kampagne aktualisieren
- [ ] DELETE /kampagnen/:id – Kampagne archivieren
- [ ] POST /kampagnen/:id/duplizieren
- [ ] Webhook-Slug automatisch generieren (unique)
- [ ] Trigger-Konfiguration verschlüsselt speichern

### 2.2 Kampagnenfelder Backend
- [ ] POST /kampagnen/:id/felder
- [ ] PUT /kampagnen/:id/felder (Reihenfolge aktualisieren)
- [ ] DELETE /kampagnen/:id/felder/:feld_id

### 2.3 Lead-Eingang (Webhook)
- [ ] POST /webhooks/:kampagne_slug (generischer Webhook)
- [ ] HMAC-Signaturverifikation
- [ ] Lead-Normalisierungsfunktion (Telefon → +49)
- [ ] Duplikatserkennung (E-Mail + Telefon)
- [ ] Lead in PostgreSQL speichern (leads + lead_felddaten)
- [ ] Status-Historie automatisch anlegen
- [ ] Aktivitätslog-Eintrag erstellen
- [ ] Job in job_queue für Automatisierungen einreihen

### 2.4 Lead-Verwaltung Backend
- [ ] GET /kampagnen/:id/leads (mit Filtern und Paginierung)
- [ ] GET /leads/:id (vollständiges Profil)
- [ ] PATCH /leads/:id (Status, Zuweisung)
- [ ] POST /leads/:id/notizen
- [ ] GET /leads/export (CSV)
- [ ] Volltextsuche implementieren
- [ ] Soft-Delete (gelöscht=true, Papierkorb 90 Tage)

### 2.5 WebSocket (Echtzeit)
- [ ] Socket.IO Server aufsetzen
- [ ] Event: `lead:neu` – Bei neuem Lead
- [ ] Event: `lead:aktualisiert` – Bei Statusänderung
- [ ] Authentifizierung für WebSocket-Verbindungen
- [ ] Raum-basiertes Broadcasting (pro Kampagne)

### 2.6 Kampagnen-Wizard Frontend (5 Schritte)
- [ ] Schritt 1: Kampagnenname und Beschreibung
- [ ] Schritt 2: Trigger-Auswahl (visuelles Grid)
- [ ] Schritt 3: Felder-Builder mit Drag & Drop
- [ ] Schritt 4: Automatisierungen (Schritt 4 – Platzhalter, Details in Phase 3)
- [ ] Schritt 5: Übersicht und Bestätigung
- [ ] Fortschrittsanzeige
- [ ] Validierung pro Schritt
- [ ] Webhook-URL anzeigen und kopieren

### 2.7 Kanban-Board Frontend
- [ ] Kanban-Board mit @dnd-kit
- [ ] Spalten = Pipeline-Status der Kampagne
- [ ] Lead-Karten mit Kerndaten
- [ ] Drag & Drop → API PATCH /leads/:id
- [ ] Echtzeit-Updates via WebSocket
- [ ] Lead-Detail-Modal/Seitenleiste
- [ ] Notizen im Lead-Profil hinzufügen
- [ ] Status-Historie anzeigen
- [ ] Aktivitätslog anzeigen

### 2.8 Lead-Liste Frontend
- [ ] Tabellenansicht mit Filtern
- [ ] Suche in Echtzeit (Debounce 300ms)
- [ ] Filter: Kampagne, Status, Datum, Mitarbeiter
- [ ] Paginierung
- [ ] CSV-Export-Button
- [ ] Zuweisung an Mitarbeiter

**Akzeptanzkriterien Phase 2:**
- Kampagne kann im Wizard erstellt werden
- Lead kommt via Webhook an und erscheint in der Kanban-Ansicht
- Telefonnummer wird korrekt normalisiert (+49)
- Duplikate werden erkannt und markiert
- Status-Änderung per Drag & Drop funktioniert
- Echtzeit-Update bei neuem Lead sichtbar

---

## Phase 3: Automatisierungsengine
**Dauer:** 3 Wochen  
**Priorität:** Hoch – ersetzt den gesamten n8n-Workflow

### 3.1 Automatisierungs-Backend
- [ ] GET /kampagnen/:id/automatisierungen
- [ ] POST /kampagnen/:id/automatisierungen
- [ ] PATCH /automatisierungen/:id
- [ ] DELETE /automatisierungen/:id
- [ ] Bedingungs-Evaluierungs-Engine

### 3.2 Job-Worker
- [ ] BullMQ Worker für Automatisierungs-Jobs
- [ ] Schritt-für-Schritt-Ausführung mit Zustand
- [ ] Warten-Implementierung (naechste_ausfuehrung setzen)
- [ ] Zeitfenster-Prüfung (Mo–Fr 09:00–20:00 konfigurierbar)
- [ ] Exponentielles Backoff bei Fehlern
- [ ] Max. 3 Wiederholungsversuche
- [ ] Aktivitätslog nach jedem Schritt

### 3.3 E-Mail-Dienst
- [ ] Nodemailer mit SMTP konfigurieren
- [ ] Template-Variablen auflösen ({{vorname}} etc.)
- [ ] HTML + Text-Fallback
- [ ] E-Mail-Job in BullMQ einreihen
- [ ] Versand-Status protokollieren
- [ ] Fehlerbehandlung + Admin-Benachrichtigung

### 3.4 WhatsApp-Dienst (Superchat)
- [ ] Superchat API-Client implementieren
- [ ] Kontakt suchen (nach Telefonnummer)
- [ ] Kontakt erstellen falls nicht vorhanden
- [ ] WhatsApp-Template-Nachricht senden
- [ ] Antwort-Check (Hat der Lead geantwortet?)
- [ ] Status „WhatsApp erhalten" setzen

### 3.5 Trigger-Typen implementieren
- [ ] `lead_eingetroffen` – Direkt bei Lead-Eingang
- [ ] `status_geaendert` – Via PostgreSQL-Trigger → Job-Queue
- [ ] `inaktivitaet` – Cron-Job prüft alle 15 Minuten
- [ ] `zeitplan` – Cron-basiert (BullMQ Repeatable Jobs)

### 3.6 E-Mail-Templates Backend
- [ ] GET /templates
- [ ] POST /templates
- [ ] GET /templates/:id
- [ ] PATCH /templates/:id
- [ ] DELETE /templates/:id
- [ ] POST /templates/:id/vorschau (mit Beispieldaten)

### 3.7 Automatisierungs-Editor Frontend
- [ ] Visuelle Darstellung der Automatisierungsschritte
- [ ] Schritt hinzufügen / entfernen / sortieren
- [ ] Konfiguration pro Schritt:
  - E-Mail senden → Template-Auswahl
  - WhatsApp senden → Template-ID eingeben
  - Status setzen → Statusauswahl
  - Warten → Dauer eingeben
  - Warten bis Uhrzeit → Zeitfenster konfigurieren
- [ ] Aktivieren/Deaktivieren per Toggle
- [ ] Echtzeit-Vorschau der Schrittlogik

### 3.8 Template-Editor Frontend
- [ ] Tiptap Rich-Text-Editor
- [ ] Variable-Einfüge-Buttons ({{vorname}} etc.)
- [ ] HTML-Vorschau mit Beispieldaten
- [ ] Template speichern / aktualisieren
- [ ] Template-Bibliothek (Liste aller Templates)

**Akzeptanzkriterien Phase 3:**
- Lead erhält automatisch E-Mail wenn Status „Nicht erreichbar" gesetzt wird
- E-Mail wird nur Mo–Fr 09:00–20:00 versendet (Zeitfenster)
- WhatsApp-Nachricht wird über Superchat gesendet
- Fehlgeschlagene Jobs werden 3× wiederholt
- Aktivitätslog zeigt alle Automatisierungsschritte

---

## Phase 4: Externe Integrationen
**Dauer:** 2 Wochen  
**Priorität:** Hoch

### 4.1 Facebook Lead Ads Integration
- [ ] POST /webhooks/facebook/verify (Webhook-Verifikation)
- [ ] POST /webhooks/facebook/:kampagne_slug
- [ ] Facebook Graph API-Client
- [ ] HMAC x-hub-signature-256 Verifikation
- [ ] Feldmapping (Facebook-Felder → Kampagnenfelder)
- [ ] Seiten und Formulare im Wizard auswählen

### 4.2 Calendly Integration
- [ ] POST /webhooks/calendly (Terminbuchung)
- [ ] Calendly-Webhook-Signatur verifizieren
- [ ] Lead-Zuordnung per E-Mail oder Telefon
- [ ] Status automatisch auf „Termin gebucht" setzen
- [ ] Google Calendar-Termin verknüpfen
- [ ] Fallback: Admin-Benachrichtigung bei unbekanntem Kontakt

### 4.3 Google Calendar Integration
- [ ] OAuth 2.0 Authentifizierungsfluss
- [ ] GET /termine – Termine abrufen (nächste 30 Tage)
- [ ] Termin im Lead-Profil anzeigen
- [ ] Kalenderansicht im Frontend

### 4.4 Integrationen-Verwaltung Backend
- [ ] GET /integrationen – Alle konfigurierten Integrationen
- [ ] PATCH /integrationen/:name – Integration konfigurieren
- [ ] POST /integrationen/:name/testen – Verbindungstest
- [ ] AES-256 Verschlüsselung für API-Schlüssel

### 4.5 Integrationen-Seite Frontend
- [ ] Übersicht aller verfügbaren Integrationen
- [ ] Konfigurationsformular pro Integration
- [ ] Verbindungstest-Button mit Feedback
- [ ] Status-Anzeige (verbunden / nicht verbunden)

**Akzeptanzkriterien Phase 4:**
- Facebook Lead Ads Webhook empfängt echte Leads
- Calendly-Termin setzt Lead-Status automatisch
- Google Calendar zeigt Termine an
- API-Schlüssel werden verschlüsselt gespeichert

---

## Phase 5: Analytics, Benutzer & Feinschliff
**Dauer:** 2 Wochen  
**Priorität:** Mittel

### 5.1 Analytics Backend
- [ ] GET /analytics/uebersicht (Plattform-KPIs)
- [ ] GET /analytics/kampagnen/:id (Kampagnen-Details)
- [ ] Zeitreihen-Abfragen (täglich/wöchentlich/monatlich)
- [ ] Status-Verteilung pro Kampagne
- [ ] Automatisierungs-Report

### 5.2 Analytics Frontend
- [ ] KPI-Karten (Recharts)
- [ ] Lead-Zeitreihen-Diagramm (Liniendiagramm)
- [ ] Funnel-Visualisierung (Balkendiagramm)
- [ ] Quellen-Vergleich
- [ ] Zeitraum-Filter (heute, Woche, Monat, Quartal)
- [ ] CSV/PDF-Export

### 5.3 Benutzerverwaltung
- [ ] GET /benutzer (nur Admin)
- [ ] POST /benutzer (Admin erstellt Benutzer)
- [ ] PATCH /benutzer/:id (Rolle, Status)
- [ ] DELETE /benutzer/:id (deaktivieren)
- [ ] Profil-Seite (eigene Daten bearbeiten, Passwort ändern)

### 5.4 Kalender-Ansicht Frontend
- [ ] Monatsansicht mit Terminen
- [ ] Termin-Klick → Lead-Profil öffnen
- [ ] Kommende Termine in der Seitenleiste

### 5.5 UI-Feinschliff
- [ ] Dark Mode vollständig implementieren
- [ ] Responsive Design (Tablet-Ansicht)
- [ ] Ladeanimationen (Skeleton Loader)
- [ ] Toast-Benachrichtigungen (Erfolg, Fehler, Info)
- [ ] Leere Zustände (Empty States) für alle Listen
- [ ] Bestätigungsdialoge für kritische Aktionen
- [ ] Tastenkürzel (z.B. N = Neuer Lead, F = Filter)

**Akzeptanzkriterien Phase 5:**
- Analytics-Dashboard zeigt korrekte Daten
- Admin kann Benutzer verwalten
- Dark Mode funktioniert ohne Darstellungsfehler
- Alle Ladeanimationen vorhanden

---

## Phase 6: Testing & Produktions-Deployment
**Dauer:** 2 Wochen  
**Priorität:** Kritisch

### 6.1 Backend-Tests
- [ ] Unit-Tests für alle Dienste (Jest)
- [ ] Integration-Tests für alle API-Endpunkte (Supertest)
- [ ] Webhook-Tests (Mock-Payloads von Facebook, Calendly)
- [ ] Automatisierungs-Engine-Tests
- [ ] Datenbankfunktionen-Tests
- [ ] Ziel: > 80 % Code-Abdeckung

### 6.2 Frontend-Tests
- [ ] Komponenten-Tests (React Testing Library)
- [ ] E2E-Tests für kritische Flows (Playwright):
  - Anmelden
  - Kampagne erstellen
  - Lead empfangen und verarbeiten
  - Automatisierung konfigurieren

### 6.3 Sicherheits-Audit
- [ ] Abhängigkeiten auf Schwachstellen prüfen (npm audit)
- [ ] OWASP Top 10 Checkliste durchgehen
- [ ] SQL-Injection-Tests
- [ ] XSS-Tests
- [ ] CSRF-Schutz verifizieren

### 6.4 Performance-Tests
- [ ] API-Lasttest (k6): 100 gleichzeitige Benutzer
- [ ] Datenbankabfragen optimieren (EXPLAIN ANALYZE)
- [ ] Frontend-Bundle-Größe optimieren
- [ ] Core Web Vitals prüfen

### 6.5 Produktions-Infrastruktur
- [ ] VPS aufsetzen (Ubuntu 22.04 LTS)
- [ ] Docker + Docker Compose installieren
- [ ] Nginx als Reverse Proxy konfigurieren
- [ ] SSL-Zertifikat (Let's Encrypt / Certbot)
- [ ] Umgebungsvariablen für Produktion setzen
- [ ] Tägliche Datenbankbackups (pg_dump → S3 oder lokaler Speicher)
- [ ] Monitoring: Uptime-Robot oder ähnlich

### 6.6 CI/CD Pipeline
- [ ] GitHub Actions Workflow:
  - Push → Tests ausführen
  - Merge in main → Docker-Build + Deploy
- [ ] Automatische Datenbankmigrationen bei Deployment
- [ ] Rollback-Strategie definieren

### 6.7 Übergabe & Dokumentation
- [ ] README.md mit Installationsanleitung
- [ ] BETRIEB.md mit Wartungsanleitung
- [ ] Team-Einführung (1-stündige Demo)
- [ ] Erste echte Kampagne gemeinsam einrichten

**Akzeptanzkriterien Phase 6:**
- Alle Tests grün
- Plattform läuft stabil auf Produktionsserver
- SSL-Zertifikat aktiv
- Automatische Backups konfiguriert
- Team kann selbständig Kampagnen erstellen

---

## Zeitplan-Übersicht

| Woche | Phase | Meilenstein |
|-------|-------|-------------|
| 1–2 | Phase 1 | Infrastruktur + Auth läuft |
| 3–5 | Phase 2 | Erste echte Leads kommen an |
| 6–8 | Phase 3 | Automatisierungen ersetzen n8n |
| 9–10 | Phase 4 | Facebook + Calendly integriert |
| 11–12 | Phase 5 | Analytics + vollständige UI |
| 13–14 | Phase 6 | Produktiv-Start 🚀 |

---

## Priorisierungs-Matrix

| Funktion | Priorität | Phase |
|----------|-----------|-------|
| Authentifizierung | P0 – Muss | 1 |
| Webhook-Eingang | P0 – Muss | 2 |
| Kanban-Pipeline | P0 – Muss | 2 |
| E-Mail-Automatisierung | P0 – Muss | 3 |
| Facebook Integration | P0 – Muss | 4 |
| WhatsApp (Superchat) | P1 – Wichtig | 3 |
| Calendly Integration | P1 – Wichtig | 4 |
| Analytics | P1 – Wichtig | 5 |
| Google Calendar | P2 – Nice-to-have | 4 |
| Dark Mode | P2 – Nice-to-have | 5 |
| CSV-Export | P2 – Nice-to-have | 2 |
| Mobile Ansicht | P3 – Zukunft | – |

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
