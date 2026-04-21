-- Demo-Freigabe-Flag fuer Kampagnen. Nur Kampagnen mit ist_demo_verfuegbar=true
-- koennen ueber die oeffentliche /demo/<slug>-Seite Anrufe ausloesen.
ALTER TABLE "kampagnen" ADD COLUMN "ist_demo_verfuegbar" BOOLEAN NOT NULL DEFAULT false;
