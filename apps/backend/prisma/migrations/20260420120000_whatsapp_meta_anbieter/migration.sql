-- AlterEnum
ALTER TYPE "AktivitaetTyp" ADD VALUE 'whatsapp_empfangen';

-- AlterTable Kampagne: WhatsApp-Anbieter + Meta-spezifische Felder
ALTER TABLE "kampagnen"
  ADD COLUMN "whatsapp_anbieter" TEXT NOT NULL DEFAULT 'superchat',
  ADD COLUMN "whatsapp_meta_phone_number_id" TEXT,
  ADD COLUMN "whatsapp_template_verpasst_name" TEXT,
  ADD COLUMN "whatsapp_template_verpasst_sprache" TEXT DEFAULT 'de',
  ADD COLUMN "whatsapp_template_unerreichbar_name" TEXT,
  ADD COLUMN "whatsapp_template_unerreichbar_sprache" TEXT DEFAULT 'de',
  ADD COLUMN "whatsapp_template_nicht_interessiert_name" TEXT,
  ADD COLUMN "whatsapp_template_nicht_interessiert_sprache" TEXT DEFAULT 'de';
