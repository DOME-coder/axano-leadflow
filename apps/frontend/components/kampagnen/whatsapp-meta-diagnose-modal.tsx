'use client';

import { X, CheckCircle2, AlertTriangle, XCircle, Phone, MessageSquare, Loader2 } from 'lucide-react';
import type { WhatsappDiagnose } from '@/hooks/benutze-kunden-integrationen';

interface WhatsappMetaDiagnoseModalProps {
  diagnose: WhatsappDiagnose | null;
  laedt: boolean;
  fehler: string | null;
  onSchliessen: () => void;
}

export function WhatsappMetaDiagnoseModal({
  diagnose,
  laedt,
  fehler,
  onSchliessen,
}: WhatsappMetaDiagnoseModalProps) {
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
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}
        >
          <div>
            <h2 className="ax-ueberschrift-3">WhatsApp Business prüfen</h2>
            <p className="text-xs ax-text-sekundaer mt-0.5">
              Live-Check bei Meta: Business Account, Telefonnummern und Templates
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

        <div className="flex-1 overflow-y-auto p-6">
          {laedt ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-axano-orange animate-spin" strokeWidth={2} />
              <p className="text-sm ax-text-sekundaer">Prüfe Verbindung bei Meta…</p>
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

              {/* Verbundene WABA + Phone Number */}
              <div>
                <h3 className="ax-label mb-2">Verbundener Business Account</h3>
                {diagnose.verbundeneWaba ? (
                  <div
                    className="rounded-xl p-3 space-y-1"
                    style={{
                      backgroundColor: 'var(--karte-erhoeht)',
                      border: '1px solid var(--rahmen-leicht)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 ax-text-tertiaer" strokeWidth={2} />
                      <span className="text-sm font-semibold ax-titel">{diagnose.verbundeneWaba.name}</span>
                    </div>
                    {diagnose.verbundenePhoneNumber && (
                      <div className="flex items-center gap-2 pl-6">
                        <Phone className="w-3.5 h-3.5 ax-text-tertiaer" strokeWidth={2} />
                        <span className="text-xs ax-text-sekundaer tabular-nums">
                          {diagnose.verbundenePhoneNumber.display}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm ax-text-sekundaer">
                    {diagnose.verbindungsFehler || 'Kein Business Account verbunden'}
                  </p>
                )}
              </div>

              {/* Alle WABAs */}
              {diagnose.wabas.length > 0 && (
                <div>
                  <h3 className="ax-label mb-2">
                    Alle WhatsApp Business Accounts ({diagnose.wabas.length})
                  </h3>
                  <div className="space-y-2">
                    {diagnose.wabas.map((waba) => (
                      <div
                        key={waba.id}
                        className="rounded-xl p-4"
                        style={{
                          backgroundColor: waba.istVerbunden ? 'var(--akzent-orange-sanft)' : 'var(--karte-erhoeht)',
                          border: waba.istVerbunden
                            ? '1px solid var(--akzent-orange-rand)'
                            : '1px solid var(--rahmen-leicht)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <MessageSquare className="w-3.5 h-3.5 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
                          <span className="text-sm font-semibold ax-titel truncate">{waba.name}</span>
                          {waba.istVerbunden && (
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: 'var(--axano-orange)', color: 'white' }}
                            >
                              Verbunden
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 flex-wrap text-xs ax-text-sekundaer pl-5">
                          <span className="tabular-nums">
                            {waba.phoneNumbers.length} Nummer{waba.phoneNumbers.length === 1 ? '' : 'n'}
                          </span>
                          <span className="tabular-nums">
                            {waba.templateGenehmigt ?? 0} genehmigte / {waba.templateAnzahl ?? 0} Templates
                          </span>
                        </div>
                        {waba.phoneNumbers.length > 0 && (
                          <ul className="mt-2 space-y-1 pl-5">
                            {waba.phoneNumbers.map((n) => (
                              <li key={n.id} className="flex items-center gap-2 text-[11px] ax-text-sekundaer">
                                <Phone className="w-3 h-3 ax-text-tertiaer" strokeWidth={2} />
                                <span className="tabular-nums">{n.displayPhoneNumber}</span>
                                <span className="ax-text-tertiaer">·</span>
                                <span>{n.verifiedName}</span>
                                {n.qualityRating && (
                                  <span className="ax-text-tertiaer">· {n.qualityRating}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Berechtigungen */}
              {(diagnose.erteilteBerechtigungen.length > 0 || diagnose.fehlendeBerechtigungen.length > 0) && (
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
