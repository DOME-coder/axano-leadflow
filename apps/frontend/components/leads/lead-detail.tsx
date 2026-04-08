'use client';

import { useState } from 'react';
import { X, Send, Clock, User, Mail, Phone, Calendar, ExternalLink } from 'lucide-react';
import { benutzeLead, benutzeNotizHinzufuegen } from '@/hooks/benutze-leads';
import { statusFarbeErmitteln } from '@/lib/typen';

interface LeadDetailProps {
  leadId: string;
  onSchliessen: () => void;
}

export function LeadDetail({ leadId, onSchliessen }: LeadDetailProps) {
  const { data: lead, isLoading } = benutzeLead(leadId);
  const notizHinzufuegen = benutzeNotizHinzufuegen();
  const [neueNotiz, setNeueNotiz] = useState('');

  const notizAbsenden = async () => {
    if (!neueNotiz.trim()) return;
    await notizHinzufuegen.mutateAsync({ leadId, inhalt: neueNotiz.trim() });
    setNeueNotiz('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20" onClick={onSchliessen} />

      {/* Panel */}
      <div className="relative w-full max-w-lg ax-karte shadow-xl flex flex-col animate-einblenden rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b ax-rahmen-leicht">
          <h2 className="font-bold ax-titel">Lead-Details</h2>
          <button
            onClick={onSchliessen}
            className="p-1.5 rounded-lg ax-text-tertiaer ax-hover hover:text-[var(--text)] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 p-6 space-y-4">
            <div className="skeleton h-8 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
          </div>
        ) : lead ? (
          <div className="flex-1 overflow-y-auto">
            {/* Kontaktdaten */}
            <div className="px-6 py-4 border-b ax-rahmen-leicht">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-axano-primaer flex items-center justify-center text-white font-bold">
                  {(lead.vorname?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold ax-titel text-lg">
                    {[lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
                  </h3>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusFarbeErmitteln(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm ax-text">
                    <Mail className="w-4 h-4 ax-text-tertiaer" />
                    {lead.email}
                  </div>
                )}
                {lead.telefon && (
                  <div className="flex items-center gap-2 text-sm ax-text">
                    <Phone className="w-4 h-4 ax-text-tertiaer" />
                    {lead.telefon}
                  </div>
                )}
                {lead.zugewiesenAn && (
                  <div className="flex items-center gap-2 text-sm ax-text">
                    <User className="w-4 h-4 ax-text-tertiaer" />
                    Zugewiesen an: {typeof lead.zugewiesenAn === 'object' ? `${lead.zugewiesenAn.vorname} ${lead.zugewiesenAn.nachname}` : lead.zugewiesenAn}
                  </div>
                )}
              </div>
            </div>

            {/* Zusatzfelder */}
            {lead.felder && Object.keys(lead.felder).length > 0 && (
              <div className="px-6 py-4 border-b ax-rahmen-leicht">
                <h4 className="text-xs font-semibold ax-text-sekundaer uppercase tracking-wide mb-2">
                  Kampagnenfelder
                </h4>
                <div className="space-y-1.5">
                  {Object.entries(lead.felder).map(([schluessel, wert]) => (
                    <div key={schluessel} className="flex justify-between text-sm">
                      <span className="ax-text-sekundaer">
                        {typeof wert === 'object' && wert && 'bezeichnung' in wert
                          ? (wert as { bezeichnung: string }).bezeichnung
                          : schluessel}
                      </span>
                      <span className="font-medium ax-titel">
                        {typeof wert === 'object' && wert && 'wert' in wert
                          ? String((wert as { wert: string }).wert)
                          : String(wert)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weitere Daten aus dem Webhook (nicht als Kampagnenfeld definiert) */}
            {(() => {
              const rohdaten = (lead as { rohdaten?: Record<string, unknown> | null }).rohdaten;
              if (!rohdaten || typeof rohdaten !== 'object') return null;

              // Standardfelder, die schon in der Kontaktdaten-Sektion stehen
              const standardSchluessel = new Set([
                'vorname', 'first_name', 'firstname', 'name',
                'nachname', 'last_name', 'lastname', 'surname',
                'email', 'e_mail', 'mail', 'email_address',
                'telefon', 'phone', 'phone_number', 'tel', 'telefonnummer', 'mobile',
              ]);

              // Schlüssel, die schon als definiertes Kampagnenfeld oben angezeigt werden
              const definierteFeldnamen = new Set(Object.keys(lead.felder ?? {}));

              const weitere = Object.entries(rohdaten).filter(
                ([key, value]) =>
                  !standardSchluessel.has(key) &&
                  !definierteFeldnamen.has(key) &&
                  value !== null &&
                  value !== undefined &&
                  value !== ''
              );

              if (weitere.length === 0) return null;

              return (
                <div className="px-6 py-4 border-b ax-rahmen-leicht">
                  <h4 className="text-xs font-semibold ax-text-sekundaer uppercase tracking-wide mb-2">
                    Weitere Daten
                  </h4>
                  <div className="space-y-1.5">
                    {weitere.map(([schluessel, wert]) => (
                      <div key={schluessel} className="flex justify-between text-sm gap-3">
                        <span className="ax-text-sekundaer break-words">{schluessel}</span>
                        <span className="font-medium ax-titel text-right break-words">
                          {typeof wert === 'object' ? JSON.stringify(wert) : String(wert)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Status-Historie */}
            {lead.statusHistorie && lead.statusHistorie.length > 0 && (
              <div className="px-6 py-4 border-b ax-rahmen-leicht">
                <h4 className="text-xs font-semibold ax-text-sekundaer uppercase tracking-wide mb-2">
                  Status-Verlauf
                </h4>
                <div className="space-y-2">
                  {lead.statusHistorie.slice(0, 10).map((eintrag: { id: string; alterStatus: string | null; neuerStatus: string; erstelltAm: string }) => (
                    <div key={eintrag.id} className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3 ax-text-tertiaer" />
                      <span className="ax-text-sekundaer">
                        {new Date(eintrag.erstelltAm).toLocaleString('de-DE')}
                      </span>
                      <span className="ax-text-tertiaer">&rarr;</span>
                      <span className={`font-medium px-1.5 py-0.5 rounded ${statusFarbeErmitteln(eintrag.neuerStatus)}`}>
                        {eintrag.neuerStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Termine */}
            {lead.termine && lead.termine.length > 0 && (
              <div className="px-6 py-4 border-b ax-rahmen-leicht">
                <h4 className="text-xs font-semibold ax-text-sekundaer uppercase tracking-wide mb-3">
                  Termine
                </h4>
                <div className="space-y-2">
                  {lead.termine.map((termin: { id: string; titel: string; beginnAm: string; quelle?: string; meetingLink?: string | null }) => (
                    <div key={termin.id} className="ax-karte-erhoeht rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium ax-titel flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> {termin.titel}
                        </span>
                        {termin.quelle && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {termin.quelle}
                          </span>
                        )}
                      </div>
                      <p className="text-xs ax-text-sekundaer">
                        {new Date(termin.beginnAm).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      {termin.meetingLink && (
                        <a href={termin.meetingLink} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-axano-orange hover:underline mt-1 inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Meeting beitreten
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notizen */}
            <div className="px-6 py-4">
              <h4 className="text-xs font-semibold ax-text-sekundaer uppercase tracking-wide mb-3">
                Notizen
              </h4>
              {lead.notizen && lead.notizen.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {lead.notizen.map((notiz: { id: string; inhalt: string; autor: { vorname: string; nachname: string } | null; erstelltAm: string }) => (
                    <div key={notiz.id} className="ax-karte-erhoeht rounded-lg p-3">
                      <p className="text-sm ax-titel">{notiz.inhalt}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs ax-text-tertiaer">
                        <span>{notiz.autor ? `${notiz.autor.vorname} ${notiz.autor.nachname}` : 'System'}</span>
                        <span>&middot;</span>
                        <span>{new Date(notiz.erstelltAm).toLocaleString('de-DE')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm ax-text-tertiaer mb-4">Noch keine Notizen</p>
              )}

              {/* Neue Notiz */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neueNotiz}
                  onChange={(e) => setNeueNotiz(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && notizAbsenden()}
                  className="flex-1 px-3 py-2 text-sm rounded-lg ax-eingabe"
                  placeholder="Notiz hinzufügen..."
                />
                <button
                  onClick={notizAbsenden}
                  disabled={!neueNotiz.trim() || notizHinzufuegen.isPending}
                  className="bg-axano-primaer hover:bg-axano-sekundaer text-white p-2 rounded-lg transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
