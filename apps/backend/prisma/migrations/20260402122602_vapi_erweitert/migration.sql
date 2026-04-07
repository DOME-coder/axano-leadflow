-- CreateEnum
CREATE TYPE "Rolle" AS ENUM ('admin', 'mitarbeiter');

-- CreateEnum
CREATE TYPE "KampagnenStatus" AS ENUM ('aktiv', 'pausiert', 'archiviert');

-- CreateEnum
CREATE TYPE "TriggerTyp" AS ENUM ('facebook_lead_ads', 'webhook', 'email', 'whatsapp', 'webformular');

-- CreateEnum
CREATE TYPE "FeldTyp" AS ENUM ('text', 'zahl', 'email', 'telefon', 'datum', 'auswahl', 'ja_nein', 'mehrzeilig');

-- CreateEnum
CREATE TYPE "AktivitaetTyp" AS ENUM ('lead_erstellt', 'status_geaendert', 'notiz_hinzugefuegt', 'email_gesendet', 'whatsapp_gesendet', 'termin_gebucht', 'automatisierung_ausgefuehrt', 'anruf_gestartet', 'anruf_abgeschlossen', 'anruf_fehlgeschlagen', 'fehler', 'manuell');

-- CreateEnum
CREATE TYPE "AutoTriggerTyp" AS ENUM ('lead_eingetroffen', 'status_geaendert', 'inaktivitaet', 'zeitplan');

-- CreateEnum
CREATE TYPE "AktionTyp" AS ENUM ('email_senden', 'whatsapp_senden', 'status_setzen', 'benachrichtigung', 'warten', 'warten_bis_uhrzeit', 'vapi_anruf', 'vapi_sequenz');

-- CreateEnum
CREATE TYPE "AusfuehrungsStatus" AS ENUM ('laeuft', 'abgeschlossen', 'fehler', 'abgebrochen');

-- CreateEnum
CREATE TYPE "TerminQuelle" AS ENUM ('calendly', 'google_calendar', 'manuell');

-- CreateEnum
CREATE TYPE "AnrufStatus" AS ENUM ('geplant', 'laeuft', 'abgeschlossen', 'fehler');

-- CreateEnum
CREATE TYPE "AnrufErgebnis" AS ENUM ('interessiert', 'nicht_interessiert', 'voicemail', 'falsche_nummer', 'nicht_abgenommen', 'aufgelegt', 'hung_up', 'disconnected');

-- CreateTable
CREATE TABLE "benutzer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwort_hash" TEXT NOT NULL,
    "vorname" TEXT NOT NULL,
    "nachname" TEXT NOT NULL,
    "rolle" "Rolle" NOT NULL DEFAULT 'mitarbeiter',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "letzter_login" TIMESTAMP(3),
    "login_versuche" INTEGER NOT NULL DEFAULT 0,
    "gesperrt_bis" TIMESTAMP(3),
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benutzer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kampagnen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "status" "KampagnenStatus" NOT NULL DEFAULT 'aktiv',
    "trigger_typ" "TriggerTyp" NOT NULL,
    "trigger_konfiguration" JSONB NOT NULL DEFAULT '{}',
    "webhook_slug" TEXT,
    "pipeline_spalten" JSONB NOT NULL DEFAULT '["Neu","Anruf läuft","Voicemail","Follow-up","Nicht erreichbar","Falsche Nummer","Nicht interessiert","Termin gebucht"]',
    "vapi_aktiviert" BOOLEAN NOT NULL DEFAULT false,
    "vapi_assistant_id" TEXT,
    "vapi_phone_number_id" TEXT,
    "vapi_prompt" TEXT,
    "vapi_erste_botschaft" TEXT,
    "vapi_voicemail_nachricht" TEXT,
    "max_anruf_versuche" INTEGER NOT NULL DEFAULT 11,
    "anruf_zeitslots" JSONB NOT NULL DEFAULT '[{"stunde":9,"minute":0},{"stunde":12,"minute":30},{"stunde":17,"minute":0},{"stunde":18,"minute":0},{"stunde":19,"minute":0}]',
    "email_aktiviert" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_aktiviert" BOOLEAN NOT NULL DEFAULT false,
    "benachrichtigung_email" TEXT,
    "calendly_link" TEXT,
    "branche" TEXT,
    "produkt" TEXT,
    "zielgruppe" TEXT,
    "ton" TEXT,
    "ki_name" TEXT,
    "ki_geschlecht" TEXT,
    "ki_sprachstil" TEXT,
    "email_template_verpasst" TEXT,
    "email_template_voicemail" TEXT,
    "email_template_unerreichbar" TEXT,
    "whatsapp_template_verpasst" TEXT,
    "whatsapp_template_unerreichbar" TEXT,
    "whatsapp_template_nicht_interessiert" TEXT,
    "whatsapp_kanal_id" TEXT,
    "erstellt_von" TEXT,
    "kunde_id" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kampagnen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kunden" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kontaktperson" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "branche" TEXT,
    "notizen" TEXT,
    "erstellt_von" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kunden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kampagnen_felder" (
    "id" TEXT NOT NULL,
    "kampagne_id" TEXT NOT NULL,
    "feldname" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "feldtyp" "FeldTyp" NOT NULL,
    "pflichtfeld" BOOLEAN NOT NULL DEFAULT false,
    "optionen" JSONB,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "platzhalter" TEXT,
    "hilfetext" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kampagnen_felder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "kampagne_id" TEXT NOT NULL,
    "zugewiesen_an" TEXT,
    "vorname" TEXT,
    "nachname" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Neu',
    "quelle" TEXT,
    "duplikat_von" TEXT,
    "ist_duplikat" BOOLEAN NOT NULL DEFAULT false,
    "geloescht" BOOLEAN NOT NULL DEFAULT false,
    "geloescht_am" TIMESTAMP(3),
    "rohdaten" JSONB,
    "anruf_versuche_anzahl" INTEGER NOT NULL DEFAULT 0,
    "letzter_anruf_am" TIMESTAMP(3),
    "naechster_anruf_am" TIMESTAMP(3),
    "gpt_zusammenfassung" TEXT,
    "gpt_verdict" TEXT,
    "vapi_call_id" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_felddaten" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "feld_id" TEXT NOT NULL,
    "wert" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_felddaten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_historie" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "alter_status" TEXT,
    "neuer_status" TEXT NOT NULL,
    "geaendert_von" TEXT,
    "grund" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_historie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notizen" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "autor_id" TEXT,
    "inhalt" TEXT NOT NULL,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bearbeitet_am" TIMESTAMP(3),

    CONSTRAINT "lead_notizen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_aktivitaeten" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "typ" "AktivitaetTyp" NOT NULL,
    "beschreibung" TEXT NOT NULL,
    "metadaten" JSONB,
    "benutzer_id" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_aktivitaeten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automatisierungen" (
    "id" TEXT NOT NULL,
    "kampagne_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "trigger_typ" "AutoTriggerTyp" NOT NULL,
    "trigger_konfiguration" JSONB NOT NULL DEFAULT '{}',
    "bedingungen" JSONB NOT NULL DEFAULT '[]',
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automatisierungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automatisierungs_schritte" (
    "id" TEXT NOT NULL,
    "automatisierung_id" TEXT NOT NULL,
    "reihenfolge" INTEGER NOT NULL,
    "aktion_typ" "AktionTyp" NOT NULL,
    "konfiguration" JSONB NOT NULL DEFAULT '{}',
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automatisierungs_schritte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automatisierungs_ausfuehrungen" (
    "id" TEXT NOT NULL,
    "automatisierung_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "status" "AusfuehrungsStatus" NOT NULL DEFAULT 'laeuft',
    "aktueller_schritt" INTEGER NOT NULL DEFAULT 0,
    "naechste_ausfuehrung" TIMESTAMP(3),
    "fehler_nachricht" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abgeschlossen_am" TIMESTAMP(3),

    CONSTRAINT "automatisierungs_ausfuehrungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "betreff" TEXT NOT NULL,
    "html_inhalt" TEXT NOT NULL,
    "text_inhalt" TEXT,
    "variablen" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "erstellt_von" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "termine" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "kampagne_id" TEXT,
    "titel" TEXT NOT NULL,
    "beschreibung" TEXT,
    "beginn_am" TIMESTAMP(3) NOT NULL,
    "ende_am" TIMESTAMP(3),
    "quelle" "TerminQuelle",
    "externe_id" TEXT,
    "meeting_link" TEXT,
    "teilnehmer" JSONB,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "termine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrationen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" TEXT NOT NULL,
    "konfiguration" JSONB NOT NULL DEFAULT '{}',
    "aktiv" BOOLEAN NOT NULL DEFAULT false,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrationen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anruf_versuche" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "kampagne_id" TEXT NOT NULL,
    "versuch_nummer" INTEGER NOT NULL,
    "vapi_call_id" TEXT,
    "status" "AnrufStatus" NOT NULL DEFAULT 'geplant',
    "geplant_fuer" TIMESTAMP(3) NOT NULL,
    "gestartet_am" TIMESTAMP(3),
    "beendet_am" TIMESTAMP(3),
    "dauer_sekunden" INTEGER,
    "ergebnis" "AnrufErgebnis",
    "transkript" TEXT,
    "gpt_analyse" TEXT,
    "fehler_nachricht" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anruf_versuche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_vorlagen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "branche" TEXT NOT NULL,
    "produkt" TEXT,
    "vapi_prompt" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "erstellt_von" TEXT,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_vorlagen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "benutzer_email_key" ON "benutzer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "kampagnen_webhook_slug_key" ON "kampagnen"("webhook_slug");

-- CreateIndex
CREATE UNIQUE INDEX "kampagnen_felder_kampagne_id_feldname_key" ON "kampagnen_felder"("kampagne_id", "feldname");

-- CreateIndex
CREATE UNIQUE INDEX "lead_felddaten_lead_id_feld_id_key" ON "lead_felddaten"("lead_id", "feld_id");

-- CreateIndex
CREATE UNIQUE INDEX "integrationen_name_key" ON "integrationen"("name");

-- CreateIndex
CREATE UNIQUE INDEX "anruf_versuche_vapi_call_id_key" ON "anruf_versuche"("vapi_call_id");

-- CreateIndex
CREATE INDEX "anruf_versuche_lead_id_idx" ON "anruf_versuche"("lead_id");

-- CreateIndex
CREATE INDEX "anruf_versuche_kampagne_id_idx" ON "anruf_versuche"("kampagne_id");

-- CreateIndex
CREATE INDEX "anruf_versuche_vapi_call_id_idx" ON "anruf_versuche"("vapi_call_id");

-- AddForeignKey
ALTER TABLE "kampagnen" ADD CONSTRAINT "kampagnen_erstellt_von_fkey" FOREIGN KEY ("erstellt_von") REFERENCES "benutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kampagnen" ADD CONSTRAINT "kampagnen_kunde_id_fkey" FOREIGN KEY ("kunde_id") REFERENCES "kunden"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kampagnen_felder" ADD CONSTRAINT "kampagnen_felder_kampagne_id_fkey" FOREIGN KEY ("kampagne_id") REFERENCES "kampagnen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_kampagne_id_fkey" FOREIGN KEY ("kampagne_id") REFERENCES "kampagnen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_zugewiesen_an_fkey" FOREIGN KEY ("zugewiesen_an") REFERENCES "benutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_felddaten" ADD CONSTRAINT "lead_felddaten_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_felddaten" ADD CONSTRAINT "lead_felddaten_feld_id_fkey" FOREIGN KEY ("feld_id") REFERENCES "kampagnen_felder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_historie" ADD CONSTRAINT "lead_status_historie_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notizen" ADD CONSTRAINT "lead_notizen_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notizen" ADD CONSTRAINT "lead_notizen_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "benutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_aktivitaeten" ADD CONSTRAINT "lead_aktivitaeten_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automatisierungen" ADD CONSTRAINT "automatisierungen_kampagne_id_fkey" FOREIGN KEY ("kampagne_id") REFERENCES "kampagnen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automatisierungs_schritte" ADD CONSTRAINT "automatisierungs_schritte_automatisierung_id_fkey" FOREIGN KEY ("automatisierung_id") REFERENCES "automatisierungen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automatisierungs_ausfuehrungen" ADD CONSTRAINT "automatisierungs_ausfuehrungen_automatisierung_id_fkey" FOREIGN KEY ("automatisierung_id") REFERENCES "automatisierungen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termine" ADD CONSTRAINT "termine_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anruf_versuche" ADD CONSTRAINT "anruf_versuche_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
