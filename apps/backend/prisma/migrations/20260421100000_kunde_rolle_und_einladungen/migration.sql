-- AlterEnum: Neue Rolle fuer Kunden-Self-Service
ALTER TYPE "Rolle" ADD VALUE 'kunde';

-- AlterTable Benutzer: Optionale Kunden-Zuordnung fuer Rolle "kunde"
ALTER TABLE "benutzer"
  ADD COLUMN "kunde_id" TEXT;

-- CreateIndex
CREATE INDEX "benutzer_kunde_id_idx" ON "benutzer"("kunde_id");

-- AddForeignKey
ALTER TABLE "benutzer"
  ADD CONSTRAINT "benutzer_kunde_id_fkey"
  FOREIGN KEY ("kunde_id") REFERENCES "kunden"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Einladungs-Token fuer Kunden-Onboarding (Token nur als SHA-256-Hash gespeichert)
CREATE TABLE "benutzer_einladungen" (
    "id" TEXT NOT NULL,
    "benutzer_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ablauf_am" TIMESTAMP(3) NOT NULL,
    "eingeloest_am" TIMESTAMP(3),
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benutzer_einladungen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "benutzer_einladungen_benutzer_id_key" ON "benutzer_einladungen"("benutzer_id");
CREATE UNIQUE INDEX "benutzer_einladungen_token_hash_key" ON "benutzer_einladungen"("token_hash");

-- AddForeignKey
ALTER TABLE "benutzer_einladungen"
  ADD CONSTRAINT "benutzer_einladungen_benutzer_id_fkey"
  FOREIGN KEY ("benutzer_id") REFERENCES "benutzer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
