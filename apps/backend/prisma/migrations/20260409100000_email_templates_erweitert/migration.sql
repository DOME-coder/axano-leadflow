-- Drei neue Email-Template-Felder fuer differenzierte Follow-ups je nach Anruf-Ergebnis
ALTER TABLE "kampagnen" ADD COLUMN "email_template_termin_bestaetigung" TEXT;
ALTER TABLE "kampagnen" ADD COLUMN "email_template_rueckruf" TEXT;
ALTER TABLE "kampagnen" ADD COLUMN "email_template_nicht_interessiert" TEXT;
