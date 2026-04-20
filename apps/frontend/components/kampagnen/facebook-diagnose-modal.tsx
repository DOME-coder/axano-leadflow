'use client';

import { X, CheckCircle2, AlertTriangle, XCircle, FileText, Globe, Loader2 } from 'lucide-react';
import type { FacebookDiagnose } from '@/hooks/benutze-kunden-integrationen';

interface FacebookDiagnoseModalProps {
  diagnose: FacebookDiagnose | null;
  laedt: boolean;
  fehler: string | null;
  onSchliessen: () => void;
}

export function FacebookDiagnoseModal({
  diagnose,
  laedt,
  fehler,
  onSchliessen,
}: FacebookDiagnoseModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(15, 22, 35, 0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onSchliessen}
      />

      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl animate-einblenden-nach-oben"
        style={{
          backgroundColor: 'var(--karte)',
          border: '1px solid var(--rahmen-leicht)',
          boxShadow: 'var(--schatten-xl)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}
        >
          <div>
            <h2 className="ax-ueberschrift-3">Facebook-Verbindung prüfen</h2>
            <p className="text-xs ax-text-sekundaer mt-0.5">
              Live-Check bei Facebook: Seite, Berechtigungen, Lead-Formulare
            </p>
          </div>
          <button
            onClick={onSchliessen}
            aria-label="Schließen"
            className="p-2 rounded-lg ax-text-tertiaer ax-hover hover:text-[var(--text-titel)] transition-all duration-200 ease-sanft ax-fokus-ring"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {laedt ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-axano-orange animate-spin" strokeWidth={2} />
              <p className="text-sm ax-text-sekundaer">Prüfe Verbindung bei Facebook…</p>
            </div>
          ) : fehler ? (
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
              }}
            >
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} strokeWidth={2} />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">Diagnose fehlgeschlagen</p>
                <p className="text-sm ax-text-sekundaer mt-1">{fehler}</p>
              </div>
            </div>
          ) : diagnose ? (
            <div className="space-y-5">
              {/* Empfehlungen (wichtigster Block) */}
              {diagnose.empfehlungen.length > 0 && (
                <div className="space-y-2">
                  {diagnose.empfehlungen.map((empfehlung, idx) => {
                    const istErfolg = empfehlung.toLowerCase().startsWith('alles in ordnung');
                    return (
                      <div
                        key={idx}
                        className="rounded-xl p-4 flex items-start gap-3"
                        style={{
                          backgroundColor: istErfolg
                            ? 'rgba(34, 197, 94, 0.08)'
                            : 'rgba(245, 158, 11, 0.08)',
                          border: `1px solid ${istErfolg ? 'rgba(34, 197, 94, 0.28)' : 'rgba(245, 158, 11, 0.28)'}`,
                        }}
                      >
                        {istErfolg ? (
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} strokeWidth={2} />
                        ) : (
                          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} strokeWidth={2} />
                        )}
                        <p
                          className={`text-sm leading-relaxed ${
                            istErfolg
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : 'text-amber-900 dark:text-amber-300'
                          }`}
                        >
                          {empfehlung}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Verbundene Seite */}
              <div>
                <h3 className="ax-label mb-2">Verbundene Seite</h3>
                {diagnose.verbundeneSeite ? (
                  <div
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{
                      backgroundColor: 'var(--karte-erhoeht)',
                      border: '1px solid var(--rahmen-leicht)',
                    }}
                  >
                    <Globe className="w-4 h-4 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold ax-titel truncate">
                        {diagnose.verbundeneSeite.name}
                      </p>
                      <p className="text-[11px] ax-text-tertiaer tabular-nums">
                        ID: {diagnose.verbundeneSeite.id}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm ax-text-sekundaer">
                    {diagnose.verbindungsFehler || 'Keine Seite verbunden'}
                  </p>
                )}
              </div>

              {/* Alle Seiten des Nutzers (wenn mehrere) */}
              {diagnose.alleSeiten.length > 1 && (
                <div>
                  <h3 className="ax-label mb-2">
                    Alle Seiten des Kunden ({diagnose.alleSeiten.length})
                  </h3>
                  <div className="space-y-1.5">
                    {diagnose.alleSeiten.map((seite) => (
                      <div
                        key={seite.id}
                        className="rounded-lg p-3 flex items-center justify-between gap-3"
                        style={{
                          backgroundColor: seite.istVerbunden ? 'var(--akzent-orange-sanft)' : 'var(--karte-erhoeht)',
                          border: seite.istVerbunden
                            ? '1px solid var(--akzent-orange-rand)'
                            : '1px solid var(--rahmen-leicht)',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe className="w-3.5 h-3.5 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
                          <span className="text-sm font-medium ax-titel truncate">{seite.name}</span>
                          {seite.istVerbunden && (
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm flex-shrink-0"
                              style={{
                                backgroundColor: 'var(--axano-orange)',
                                color: 'white',
                              }}
                            >
                              Verbunden
                            </span>
                          )}
                        </div>
                        <span className="text-xs ax-text-sekundaer tabular-nums flex-shrink-0">
                          {seite.formFehler
                            ? `Fehler: ${seite.formFehler}`
                            : `${seite.formAnzahl ?? 0} Formular${(seite.formAnzahl ?? 0) === 1 ? '' : 'e'}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gefundene Formulare */}
              <div>
                <h3 className="ax-label mb-2">
                  Gefundene Formulare ({diagnose.formulare.length})
                </h3>
                {diagnose.formulare.length > 0 ? (
                  <div className="space-y-1.5">
                    {diagnose.formulare.map((form) => {
                      const aufVerbundenerSeite = form.seiteId === diagnose.verbundeneSeite?.id;
                      return (
                        <div
                          key={form.id}
                          className="rounded-lg p-3"
                          style={{
                            backgroundColor: 'var(--karte-erhoeht)',
                            border: '1px solid var(--rahmen-leicht)',
                            opacity: aufVerbundenerSeite ? 1 : 0.6,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
                              <span className="text-sm font-semibold ax-titel truncate">{form.name}</span>
                            </div>
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0"
                              style={{
                                backgroundColor:
                                  form.status === 'ACTIVE'
                                    ? 'rgba(34, 197, 94, 0.15)'
                                    : 'rgba(148, 163, 184, 0.15)',
                                color: form.status === 'ACTIVE' ? '#15803d' : '#64748b',
                              }}
                            >
                              {form.status}
                            </span>
                          </div>
                          <p className="text-[11px] ax-text-tertiaer">
                            Seite: <span className="font-medium">{form.seiteName}</span>
                            {' · '}
                            {form.felderAnzahl} Feld{form.felderAnzahl === 1 ? '' : 'er'}
                            {!aufVerbundenerSeite && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                {' '}
                                (nicht auf verbundener Seite)
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm ax-text-sekundaer">
                    Keine Lead-Formulare auf irgendeiner Seite des Kunden gefunden.
                  </p>
                )}
              </div>

              {/* Berechtigungen */}
              {diagnose.erteilteBerechtigungen.length > 0 && (
                <div>
                  <h3 className="ax-label mb-2">Berechtigungen</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {diagnose.erteilteBerechtigungen.map((perm) => (
                      <span
                        key={perm}
                        className="text-[11px] font-mono px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(34, 197, 94, 0.12)',
                          color: '#15803d',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                        }}
                      >
                        {perm}
                      </span>
                    ))}
                    {diagnose.fehlendeBerechtigungen.map((perm) => (
                      <span
                        key={perm}
                        className="text-[11px] font-mono px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          color: '#b91c1c',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        {perm} (fehlt)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end"
          style={{ borderTop: '1px solid var(--rahmen-leicht)' }}
        >
          <button
            onClick={onSchliessen}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-sanft ax-fokus-ring ax-hover"
            style={{ border: '1px solid var(--rahmen)', color: 'var(--text-normal)' }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
