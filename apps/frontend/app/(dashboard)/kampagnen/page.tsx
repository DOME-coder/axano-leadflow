'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, Trash2, RotateCcw, XCircle } from 'lucide-react';
import { benutzeKampagnen, benutzeKampagneWiederherstellen, benutzeKampagneEndgueltigLoeschen } from '@/hooks/benutze-kampagnen';
import { benutzeIntegrationsStatus } from '@/hooks/benutze-integrationen';
import { KampagnenKarte } from '@/components/kampagnen/kampagnen-karte';
import { apiClient } from '@/lib/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function KampagnenSeite() {
  const [zeigePapierkorb, setZeigePapierkorb] = useState(false);
  const { data, isLoading } = benutzeKampagnen();
  const { data: integrationsStatus } = benutzeIntegrationsStatus();

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">Kampagnen</h1>
          <p className="text-sm ax-text-sekundaer mt-1">Verwalten Sie Ihre Lead-Kampagnen</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZeigePapierkorb(!zeigePapierkorb)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              zeigePapierkorb
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'border ax-rahmen-leicht ax-text-sekundaer ax-hover'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Papierkorb
          </button>
          <Link href="/kampagnen/neu"
            className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Neue Kampagne
          </Link>
        </div>
      </div>

      {zeigePapierkorb ? (
        <KampagnenPapierkorb />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ax-karte rounded-xl p-5 h-48">
              <div className="skeleton h-5 w-2/3 rounded mb-3" />
              <div className="skeleton h-4 w-1/2 rounded mb-6" />
              <div className="skeleton h-8 w-full rounded" />
            </div>
          ))}
        </div>
      ) : !data?.eintraege.length ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <Megaphone className="w-12 h-12 ax-text-tertiaer mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">Noch keine Kampagnen</h3>
          <p className="text-sm ax-text-sekundaer mb-4">Erstellen Sie Ihre erste Kampagne, um Leads zu empfangen.</p>
          <Link href="/kampagnen/neu"
            className="inline-flex items-center gap-2 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm">
            <Plus className="w-4 h-4" /> Erste Kampagne erstellen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.eintraege.map((kampagne) => (
            <KampagnenKarte key={kampagne.id} kampagne={kampagne} integrationsStatus={integrationsStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function KampagnenPapierkorb() {
  const queryClient = useQueryClient();
  const wiederherstellen = benutzeKampagneWiederherstellen();
  const endgueltigLoeschen = benutzeKampagneEndgueltigLoeschen();

  // Gelöschte Kampagnen direkt laden (die werden vom normalen Hook gefiltert)
  const { data, isLoading } = useQuery({
    queryKey: ['kampagnen-papierkorb'],
    queryFn: async () => {
      // Alle Kampagnen laden (inkl. gelöschte) über eine direkte DB-Abfrage
      // Da der Backend-Filter gelöschte ausschließt, brauchen wir einen eigenen Endpunkt
      // Workaround: Wir nutzen den Status-Filter nicht und filtern client-seitig
      // HINWEIS: Backend filtert bereits gelöschte raus, also brauchen wir eine alternative Route
      const { data } = await apiClient.get('/kampagnen?papierkorb=true');
      return data.daten?.eintraege || [];
    },
  });

  const wiederherstellenKlick = async (id: string) => {
    await wiederherstellen.mutateAsync(id);
    queryClient.invalidateQueries({ queryKey: ['kampagnen-papierkorb'] });
  };

  const endgueltigLoeschenKlick = async (id: string, name: string) => {
    if (!confirm(`Kampagne "${name}" ENDGÜLTIG löschen? Diese Aktion kann nicht rückgängig gemacht werden!`)) return;
    await endgueltigLoeschen.mutateAsync(id);
    queryClient.invalidateQueries({ queryKey: ['kampagnen-papierkorb'] });
  };

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  if (!data?.length) {
    return (
      <div className="ax-karte rounded-xl p-12 text-center">
        <Trash2 className="w-12 h-12 ax-text-tertiaer mx-auto mb-3" />
        <h3 className="text-lg font-semibold ax-titel mb-1">Papierkorb ist leer</h3>
        <p className="text-sm ax-text-sekundaer">Gelöschte Kampagnen erscheinen hier.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((k: { id: string; name: string; geloeschtAm: string; _count?: { leads: number } }) => (
        <div key={k.id} className="ax-karte rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium ax-titel">{k.name}</p>
            <p className="text-xs ax-text-tertiaer">
              Gelöscht am {new Date(k.geloeschtAm).toLocaleString('de-DE')}
              {k._count?.leads ? ` · ${k._count.leads} Leads` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => wiederherstellenKlick(k.id)}
              disabled={wiederherstellen.isPending}
              className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen
            </button>
            <button
              onClick={() => endgueltigLoeschenKlick(k.id, k.name)}
              disabled={endgueltigLoeschen.isPending}
              className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <XCircle className="w-3.5 h-3.5" /> Endgültig löschen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
