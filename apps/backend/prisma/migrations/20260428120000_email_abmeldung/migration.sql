-- E-Mail-Abmeldung (TMG §7 / DSGVO Art. 21): Pflicht fuer B2C-Werbe-Mails.
-- Pro Lead ein eindeutiger Token, der in jedem Abmelde-Link verwendet wird.
-- Wenn email_abgemeldet_am gesetzt ist, wird keine weitere Mail an den Lead versendet.
ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "email_abmelde_token" TEXT,
  ADD COLUMN IF NOT EXISTS "email_abgemeldet_am" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "leads_email_abmelde_token_key" ON "leads"("email_abmelde_token");
