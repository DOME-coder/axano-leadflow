-- Pre-Live Haertung:
--  1) Einwilligungs-Felder fuer B2C (UWG §7 Abs. 2 Nr. 1, DSGVO Art. 6 lit. a) — opt-in pro Kampagne
--  2) Idempotenz-Schutz fuer Calendly-Webhook (eindeutige externe_id pro Termin)

-- 1. Kampagne: Flag, ob Einwilligung vor dem ersten Anruf vorliegen muss.
-- Default false: bestehende und neue Kampagnen verhalten sich unveraendert. Erst wenn das
-- Admin-UI einen Einwilligungs-Freigabe-Button bietet, kann der Default auf true gehoben werden.
ALTER TABLE "kampagnen"
  ADD COLUMN IF NOT EXISTS "einwilligung_erforderlich" BOOLEAN NOT NULL DEFAULT false;

-- 2. Lead: Nachweis-Felder fuer die Einwilligung des Endkunden (Telefon, E-Mail, Quelle, IP, Wortlaut)
ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "einwilligung_am" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "einwilligung_quelle" TEXT,
  ADD COLUMN IF NOT EXISTS "einwilligung_ip" TEXT,
  ADD COLUMN IF NOT EXISTS "einwilligung_text" TEXT;

-- 3. Termin: externe_id (z.B. Calendly invitee uri) muss eindeutig sein, damit
-- Webhook-Retries keine Duplikat-Termine erzeugen.
-- Falls bereits Duplikate vorhanden sind, schlaegt die Migration fehl. Diagnose:
--   SELECT externe_id, COUNT(*) FROM termine WHERE externe_id IS NOT NULL GROUP BY externe_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS "termine_externe_id_key" ON "termine"("externe_id");
