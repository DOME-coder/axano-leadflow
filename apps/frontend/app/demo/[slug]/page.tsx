import { notFound } from 'next/navigation';
import { DemoFormular } from './demo-formular';

interface DemoMetadaten {
  name: string;
  beschreibung: string | null;
  kiName: string | null;
  kundeName: string | null;
}

async function demoLaden(slug: string): Promise<DemoMetadaten | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  try {
    const antwort = await fetch(`${apiUrl}/demo/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!antwort.ok) return null;
    const ergebnis = await antwort.json();
    return ergebnis.erfolg ? (ergebnis.daten as DemoMetadaten) : null;
  } catch {
    return null;
  }
}

export default async function DemoSeite({ params }: { params: { slug: string } }) {
  const metadaten = await demoLaden(params.slug);
  if (!metadaten) notFound();

  return (
    <div className="w-full max-w-md animate-einblenden">
      <div className="text-center mb-8">
        <img src="/logo.png" alt="Axano" className="h-10 mx-auto mb-2 dark:brightness-0 dark:invert" />
        <p className="text-xs ax-text-sekundaer font-medium tracking-wider uppercase">Live-Demo</p>
      </div>

      <div className="ax-karte rounded-xl p-8 shadow-sm">
        <h1 className="text-xl font-bold ax-titel mb-1">Erlebe die KI in einem echten Anruf</h1>
        <p className="text-sm ax-text-sekundaer mb-2">
          {metadaten.kundeName
            ? <>Im Rahmen der Kampagne <strong>{metadaten.name}</strong> fuer {metadaten.kundeName}.</>
            : <>Kampagne: <strong>{metadaten.name}</strong></>}
        </p>
        {metadaten.beschreibung && (
          <p className="text-sm ax-text-sekundaer mb-6 leading-relaxed">{metadaten.beschreibung}</p>
        )}

        <div className="bg-axano-orange/10 text-axano-orange text-xs rounded-lg p-3 mb-5 leading-relaxed">
          <strong>So laeuft's ab:</strong> Du traegst deinen Namen und deine Nummer ein.
          Klick auf &bdquo;Jetzt anrufen lassen&ldquo; und dein Handy klingelt in ca. 5 Sekunden.
          {metadaten.kiName && <> Du sprichst mit <strong>{metadaten.kiName}</strong>, der KI dieser Kampagne.</>}
        </div>

        <DemoFormular slug={params.slug} />
      </div>

      <p className="text-center text-xs ax-text-tertiaer mt-6">
        powered by Axano LeadFlow &middot; axano.com
      </p>
    </div>
  );
}
