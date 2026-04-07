-- CreateTable
CREATE TABLE "kunden_integrationen" (
    "id" TEXT NOT NULL,
    "kunde_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" TEXT NOT NULL,
    "konfiguration" JSONB NOT NULL DEFAULT '{}',
    "aktiv" BOOLEAN NOT NULL DEFAULT false,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kunden_integrationen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kunden_integrationen_kunde_id_name_key" ON "kunden_integrationen"("kunde_id", "name");

-- AddForeignKey
ALTER TABLE "kunden_integrationen" ADD CONSTRAINT "kunden_integrationen_kunde_id_fkey" FOREIGN KEY ("kunde_id") REFERENCES "kunden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
