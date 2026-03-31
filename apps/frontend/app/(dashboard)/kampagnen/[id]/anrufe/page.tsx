'use client';

import Link from 'next/link';
import { ArrowLeft, Phone, Play, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { benutzeKampagne } from '@/hooks/benutze-kampagnen';
import { benutzeAnrufe, benutzeAnrufeStarten } from '@/hooks/benutze-anrufe';
import { useState } from 'react';

const statusIcons: Record<string, typeof Clock> = {
  geplant: Clock,
  laeuft: Phone,
  abgeschlossen: CheckCircle,
  fehler: XCircle,
};

const ergebnisAnzeige: Record<string, { farbe: string; text: string }> = {
  interessiert: { farbe: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', text: 'Interessiert' },
  nicht_interessiert: { farbe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', text: 'Nicht interessiert' },
  voicemail: { farbe: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', text: 'Voicemail' },
  falsche_nummer: { farbe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', text: 'Falsche Nummer' },
  nicht_abgenommen: { farbe: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', text: 'Nicht abgenommen' },
  aufgelegt: { farbe: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', text: 'Aufgelegt' },
};

export default function AnrufeSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kampagne } = benutzeKampagne(id);
  const { data: anrufeData, isLoading } = benutzeAnrufe(id);
  const starten = benutzeAnrufeStarten();
  const [transkriptId, setTranskriptId] = useState<string | null>(null);

  const transkriptAnruf = anrufeData?.eintraege.find((a) => a.id === transkriptId);

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/kampagnen/${id}/leads`}
            className="p-1.5 rounded-lg ax-text-tertiaer ax-hover transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold ax-titel">Anruf-Dashboard</h1>
            <p className="text-xs ax-text-sekundaer">{kampagne?.name}</p>
          </div>
        </div>
        <button
          onClick={() => starten.mutate(id)}
          disabled={starten.isPending}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          Alle neuen Leads anrufen
        </button>
      </div>

      {/* Statistik */}
      {anrufeData && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="ax-karte rounded-xl p-4">
            <p className="text-xs ax-text-sekundaer uppercase">Gesamt</p>
            <p className="text-2xl font-bold ax-titel">{anrufeData.gesamt}</p>
          </div>
          <div className="ax-karte rounded-xl p-4">
            <p className="text-xs ax-text-sekundaer uppercase">Geplant</p>
            <p className="text-2xl font-bold text-blue-500">
              {anrufeData.eintraege.filter((a) => a.status === 'geplant').length}
            </p>
          </div>
          <div className="ax-karte rounded-xl p-4">
            <p className="text-xs ax-text-sekundaer uppercase">Interessiert</p>
            <p className="text-2xl font-bold text-green-500">
              {anrufeData.eintraege.filter((a) => a.ergebnis === 'interessiert').length}
            </p>
          </div>
          <div className="ax-karte rounded-xl p-4">
            <p className="text-xs ax-text-sekundaer uppercase">Fehler</p>
            <p className="text-2xl font-bold text-red-500">
              {anrufeData.eintraege.filter((a) => a.status === 'fehler').length}
            </p>
          </div>
        </div>
      )}

      {/* Anruf-Tabelle */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : !anrufeData?.eintraege.length ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <Phone className="w-12 h-12 ax-text-tertiaer mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">Noch keine Anrufe</h3>
          <p className="text-sm ax-text-sekundaer">
            Konfiguriere VAPI in den Kampagnen-Einstellungen und sende Leads per Webhook.
          </p>
        </div>
      ) : (
        <div className="ax-karte rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b ax-rahmen-leicht">
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-4 py-3">Lead</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-4 py-3">Versuch</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-4 py-3">Ergebnis</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-4 py-3">Dauer</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-4 py-3">Geplant für</th>
                <th className="text-right text-xs font-semibold ax-text-sekundaer uppercase px-4 py-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {anrufeData.eintraege.map((anruf) => {
                const StatusIcon = statusIcons[anruf.status] || AlertCircle;
                const ergebnis = anruf.ergebnis ? ergebnisAnzeige[anruf.ergebnis] : null;

                return (
                  <tr key={anruf.id} className="border-b ax-rahmen-leicht last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium ax-titel">
                        {[anruf.lead.vorname, anruf.lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
                      </p>
                      <p className="text-xs ax-text-tertiaer">{anruf.lead.telefon}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono ax-text">#{anruf.versuchNummer}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={`w-3.5 h-3.5 ${
                          anruf.status === 'abgeschlossen' ? 'text-green-500' :
                          anruf.status === 'fehler' ? 'text-red-500' :
                          anruf.status === 'laeuft' ? 'text-axano-orange' : 'ax-text-tertiaer'
                        }`} />
                        <span className="text-xs ax-text capitalize">{anruf.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ergebnis ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ergebnis.farbe}`}>
                          {ergebnis.text}
                        </span>
                      ) : (
                        <span className="text-xs ax-text-tertiaer">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs ax-text">
                        {anruf.dauerSekunden ? `${Math.floor(anruf.dauerSekunden / 60)}:${String(anruf.dauerSekunden % 60).padStart(2, '0')}` : '–'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs ax-text-sekundaer">
                        {new Date(anruf.geplantFuer).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {anruf.transkript && (
                        <button
                          onClick={() => setTranskriptId(transkriptId === anruf.id ? null : anruf.id)}
                          className="text-xs text-axano-orange hover:underline font-medium"
                        >
                          Transkript
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transkript-Anzeige */}
      {transkriptAnruf?.transkript && (
        <div className="ax-karte rounded-xl p-5 mt-4">
          <h3 className="font-semibold ax-titel text-sm mb-2">
            Transkript – {[transkriptAnruf.lead.vorname, transkriptAnruf.lead.nachname].filter(Boolean).join(' ')} (Versuch #{transkriptAnruf.versuchNummer})
          </h3>
          <p className="text-xs ax-text-sekundaer mb-2">
            GPT-Analyse: <span className="font-semibold">{transkriptAnruf.gptAnalyse || '–'}</span>
          </p>
          <pre className="text-sm ax-text whitespace-pre-wrap ax-karte-erhoeht rounded-lg p-4 max-h-64 overflow-y-auto">
            {transkriptAnruf.transkript}
          </pre>
        </div>
      )}
    </div>
  );
}
