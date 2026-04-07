-- AlterTable
ALTER TABLE "kampagnen" ADD COLUMN     "geloescht" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "geloescht_am" TIMESTAMP(3);
