-- Indizes fuer haeufige Lookups im Webhook-Duplikat-Check und Status-Filter
CREATE INDEX "leads_telefon_idx" ON "leads"("telefon");
CREATE INDEX "leads_email_idx" ON "leads"("email");
CREATE INDEX "leads_kampagne_id_status_idx" ON "leads"("kampagne_id", "status");
