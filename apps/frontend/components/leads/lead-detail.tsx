'use client';

import { useState } from 'react';
import { X, Send, Clock, User, Mail, Phone, Calendar, ExternalLink, Trash2, PhoneCall, Sparkles, MessageSquare, Zap, AlertTriangle, PhoneOff, PhoneOutgoing, StickyNote, ArrowRight, UserPlus, Edit3, Activity, RotateCw } from 'lucide-react';
import { benutzeLead, benutzeNotizHinzufuegen, benutzeLeadLoeschen, benutzeLeadAnrufRetry } from '@/hooks/benutze-leads';
import { benutzeLeadSofortAnrufen } from '@/hooks/benutze-anrufe';
import { statusFarbeErmitteln } from '@/lib/typen';
import { useToastStore } from '@/stores/toast-store';

interface LeadDetailProps {
  leadId: string;
  onSchliessen: () => void;
}

const VERDICT_BEZEICHNUNG: Record<string, string> = {
  'appointment booked': 'Termin gebucht',
  'callback scheduled': 'Rückruf vereinbart',
  'not interested': 'Nicht interessiert',
  'wrong number': 'Falsche Nummer',
  'voicemail': 'Voicemail',
  'disconnected': 'Verbindung getrennt',
  'hung up': 'Aufgelegt',
};

const VERDICT_FARBE: Record<string, string> = {
  'appointment booked': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'callback scheduled': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'not interested': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'wrong number': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  'voicemail': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'disconnected': 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  'hung up': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function verdictAnzeigen(verdict: string): { text: string; farbe: string } {
  const schluessel = verdict.toLowerCase().trim();
  return {
    text: VERDICT_BEZEICHNUNG[schluessel] || verdict,
    farbe: VERDICT_FARBE[schluessel] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
}

const AKTIVITAET_BEZEICHNUNG: Record<string, string> = {
  lead_erstellt: 'Lead angelegt',
  status_geaendert: 'Status geändert',
  notiz_hinzugefuegt: 'Notiz hinzugefügt',
  email_gesendet: 'E-Mail gesendet',
  whatsapp_gesendet: 'WhatsApp gesendet',
  termin_gebucht: 'Termin gebucht',
  automatisierung_ausgefuehrt: 'Automatisierung ausgeführt',
  anruf_gestartet: 'Anruf gestartet',
  anruf_abgeschlossen: 'Anruf abgeschlossen',
  anruf_fehlgeschlagen: 'Anruf fehlgeschlagen',
  fehler: 'Fehler',
  manuell: 'Manuelle Aktion',
};

function aktivitaetIcon(typ: string) {
  const klasse = 'w-3.5 h-3.5';
  switch (typ) {
    case 'lead_erstellt': return <UserPlus className={`${klasse} text-blue-600`} />;
    case 'status_geaendert': return <ArrowRight className={`${klasse} text-purple-600`} />;
    case 'notiz_hinzugefuegt': return <StickyNote className={`${klasse} text-gray-600`} />;
    case 'email_gesendet': return <Mail className={`${klasse} text-orange-600`} />;
    case 'whatsapp_gesendet': return <MessageSquare className={`${klasse} text-green-600`} />;
    case 'termin_gebucht': return <Calendar className={`${klasse} text-emerald-600`} />;
    case 'automatisierung_ausgefuehrt': return <Zap className={`${klasse} text-amber-600`} />;
    case 'anruf_gestartet': return <PhoneOutgoing className={`${klasse} text-cyan-600`} />;
    case 'anruf_abgeschlossen': return <PhoneCall className={`${klasse} text-green-600`} />;
    case 'anruf_fehlgeschlagen': return <PhoneOff className={`${klasse} text-red-600`} />;
    case 'fehler': return <AlertTriangle className={`${klasse} text-red-600`} />;
    case 'manuell': return <Edit3 className={`${klasse} text-gray-600`} />;
    default: return <Activity className={`${klasse} ax-text-tertiaer`} />;
  }
}

export function LeadDetail({ leadId, onSchliessen }: LeadDetailProps) {
  const { data: lead, isLoading } = benutzeLead(leadId);
  const notizHinzufuegen = benutzeNotizHinzufuegen();
  const leadLoeschen = benutzeLeadLoeschen();
  const sofortAnrufen = benutzeLeadSofortAnrufen();
  const anrufRetry = benutzeLeadAnrufRetry();
  const { toastAnzeigen } = useToastStore();
  const [neueNotiz, setNeueNotiz] = useState('');

  const sofortAnrufenKlick = async () => {
    try {
      const ergebnis = await sofortAnrufen.mutateAsync(leadId);
      toastAnzeigen('erfolg', ergebnis.nachricht);
    } catch (fehler: unknown) {
      const f = fehler as { response?: { data?: { fehler?: string; message?: string } } };
      const nachricht =
        f?.response?.data?.fehler ||
        f?.response?.data?.message ||
        'Sofort-Anruf konnte nicht gestartet werden';
      toastAnzeigen('fehler', nachricht);
    }
  };

  const sequenzNeuStartenKlick = async () => {
    try {
      await anrufRetry.mutateAsync(leadId);
      toastAnzeigen('erfolg', 'Anruf-Sequenz neu gestartet');
    } catch (fehler: unknown) {
      const f = fehler as { response?: { data?: { fehler?: string } } };
      toastAnzeigen('fehler', f?.response?.data?.fehler || 'Neustart fehlgeschlagen');
    }
  };

  const notizAbsenden = async () => {
    if (!neueNotiz.trim()) return;
    await notizHinzufuegen.mutateAsync({ leadId, inhalt: neueNotiz.trim() });
    setNeueNotiz('');
  };

  const loeschenKlick = async () => {
    const name = lead
      ? `${(lead as { vorname?: string }).vorname || ''} ${(lead as { nachname?: string }).nachname || ''}`.trim() || 'diesen Lead'
      : 'diesen Lead';
    if (!confirm(`Lead "${name}" wirklich löschen?`)) return;
    try {
      await leadLoeschen.mutateAsync(leadId);
      toastAnzeigen('erfolg', 'Lead gelöscht');
      onSchliessen();
    } catch (fehler: unknown) {
      const f = fehler as { response?: { data?: { fehler?: string; message?: string } } };
      const nachricht =
        f?.response?.data?.fehler ||
        f?.response?.data?.message ||
        'Lead konnte nicht gelöscht werden';
      toastAnzeigen('fehler', nachricht);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(15, 22, 35, 0.35)', backdropFilter: 'blur(2px)' }}
        onClick={onSchliessen}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg flex flex-col animate-einblenden-von-rechts overflow-hidden"
        style={{
          backgroundColor: 'var(--karte)',
          borderLeft: '1px solid var(--rahmen-leicht)',
          boxShadow: 'var(--schatten-xl), -8px 0 40px -12px rgba(255, 128, 73, 0.08)',
        }}
      >
        {/* Header – sticky mit Glas-Effekt und Gradient-Fade */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{
            backgroundColor: 'var(--glas-bg)',
            backdropFilter: 'blur(12px) saturate(150%)',
            WebkitBackdropFilter: 'blur(12px) saturate(150%)',
            borderBottom: '1px solid var(--rahmen-leicht)',
          }}
        >
          <h2 className="ax-ueberschrift-3">Lead-Details</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={sofortAnrufenKlick}
              disabled={sofortAnrufen.isPending || !lead || !(lead as { telefon?: string }).telefon}
              title="Sofort anrufen (Test-Modus, umgeht Zeitslot)"
              aria-label="Lead sofort anrufen"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all duration-200 ease-sanft disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ax-fokus-ring"
              style={{
                background: 'linear-gradient(180deg, #ff8049 0%, #ea6c37 100%)',
                boxShadow: '0 1px 2px rgba(234, 108, 55, 0.3), 0 0 0 1px rgba(234, 108, 55, 0.15)',
              }}
            >
              <PhoneCall className="w-3.5 h-3.5" strokeWidth={2.2} />
              {sofortAnrufen.isPending ? 'Startet…' : 'Sofort anrufen'}
            </button>
            <button
              onClick={sequenzNeuStartenKlick}
              disabled={anrufRetry.isPending || !lead || !(lead as { telefon?: string }).telefon}
              title="Anruf-Sequenz neu starten (mit Zeitslot-Regeln und Retries)"
              aria-label="Anruf-Sequenz neu starten"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ease-sanft disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ax-fokus-ring border ax-rahmen-leicht ax-text hover:ax-hover"
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={2.2} />
              {anrufRetry.isPending ? 'Startet…' : 'Sequenz neu'}
            </button>
            <button
              onClick={loeschenKlick}
              disabled={leadLoeschen.isPending || !lead}
              title="Lead löschen"
              aria-label="Lead löschen"
              className="p-2 rounded-lg ax-text-tertiaer hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 ease-sanft disabled:opacity-40 ax-fokus-ring"
            >
              <Trash2 className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={onSchliessen}
              aria-label="Schließen"
              className="p-2 rounded-lg ax-text-tertiaer ax-hover hover:text-[var(--text-titel)] transition-all duration-200 ease-sanft ax-fokus-ring"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
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
            <div className="px-6 pt-5 pb-5" style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}>
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #1a2b4c 0%, #2f3d5f 100%)',
                    boxShadow: '0 4px 12px rgba(26, 43, 76, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  }}
                  aria-hidden
                >
                  {(lead.vorname?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="ax-ueberschrift-2 mb-1.5 truncate">
                    {[lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
                  </h3>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${statusFarbeErmitteln(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pl-[72px] -mt-2">
                {lead.email && (
                  <div className="flex items-center gap-2.5 text-sm ax-text">
                    <Mail className="w-4 h-4 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                {lead.telefon && (
                  <div className="flex items-center gap-2.5 text-sm ax-text">
                    <Phone className="w-4 h-4 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
                    <span className="tabular-nums">{lead.telefon}</span>
                  </div>
                )}
                {lead.zugewiesenAn && (
                  <div className="flex items-center gap-2.5 text-sm ax-text">
                    <User className="w-4 h-4 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
                    <span className="ax-text-sekundaer">Zugewiesen an</span>
                    <span className="font-medium">
                      {typeof lead.zugewiesenAn === 'object' ? `${lead.zugewiesenAn.vorname} ${lead.zugewiesenAn.nachname}` : lead.zugewiesenAn}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* KI-Analyse letzter Anruf – mit Orange-Akzent */}
            {(lead.gptZusammenfassung || lead.gptVerdict) && (
              <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}>
                <div
                  className="ax-karte-akzent rounded-xl p-4"
                  style={{ boxShadow: 'var(--schatten-xs)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #ff8049 0%, #ea6c37 100%)',
                        boxShadow: '0 0 12px rgba(255, 128, 73, 0.35)',
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                    </div>
                    <h4 className="ax-label">KI-Analyse letzter Anruf</h4>
                  </div>
                  {lead.gptVerdict && (() => {
                    const { text, farbe } = verdictAnzeigen(lead.gptVerdict);
                    return (
                      <div className="mb-3">
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-md ${farbe}`}>
                          {text}
                        </span>
                      </div>
                    );
                  })()}
                  {lead.gptZusammenfassung && (
                    <p className="text-sm ax-text leading-relaxed whitespace-pre-wrap">
                      {lead.gptZusammenfassung}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Zusatzfelder */}
            {lead.felder && Object.keys(lead.felder).length > 0 && (
              <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}>
                <h4 className="ax-label mb-3">Kampagnenfelder</h4>
                <dl className="space-y-2.5">
                  {Object.entries(lead.felder).map(([schluessel, wert]) => (
                    <div key={schluessel} className="flex justify-between items-baseline gap-3 text-sm">
                      <dt className="ax-text-sekundaer flex-shrink-0">
                        {typeof wert === 'object' && wert && 'bezeichnung' in wert
                          ? (wert as { bezeichnung: string }).bezeichnung
                          : schluessel}
                      </dt>
                      <dd className="font-semibold ax-titel text-right break-words">
                        {typeof wert === 'object' && wert && 'wert' in wert
                          ? String((wert as { wert: string }).wert)
                          : String(wert)}
                      </dd>
                    </div>
                  ))}
                </dl>
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
                <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}>
                  <h4 className="ax-label mb-3">Weitere Daten</h4>
                  <dl className="space-y-2.5">
                    {weitere.map(([schluessel, wert]) => (
                      <div key={schluessel} className="flex justify-between items-baseline text-sm gap-3">
                        <dt className="ax-text-sekundaer break-words flex-shrink-0">{schluessel}</dt>
                        <dd className="font-semibold ax-titel text-right break-words">
                          {typeof wert === 'object' ? JSON.stringify(wert) : String(wert)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })()}

            {/* Status-Historie */}
            {lead.statusHistorie && lead.statusHistorie.length > 0 && (
              <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}>
                <h4 className="ax-label mb-3 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" strokeWidth={2.2} /> Status-Verlauf
                </h4>
                <div className="space-y-2">
                  {lead.statusHistorie.slice(0, 10).map((eintrag: { id: string; alterStatus: string | null; neuerStatus: string; erstelltAm: string }) => (
                    <div key={eintrag.id} className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="ax-text-tertiaer tabular-nums flex-shrink-0">
                        {new Date(eintrag.erstelltAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      <span className={`font-semibold px-2 py-0.5 rounded-md ${statusFarbeErmitteln(eintrag.neuerStatus)}`}>
                        {eintrag.neuerStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aktivitäten – echte Timeline mit verbindender Linie */}
            {lead.aktivitaeten && lead.aktivitaeten.length > 0 && (
              <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}>
                <h4 className="ax-label mb-4 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" strokeWidth={2.2} /> Aktivitäten
                </h4>
                <div className="relative">
                  {/* Verbindende vertikale Linie */}
                  <div
                    className="absolute left-[11px] top-1 bottom-1 w-px"
                    style={{ backgroundColor: 'var(--rahmen)' }}
                    aria-hidden
                  />
                  <div className="space-y-3">
                    {lead.aktivitaeten.slice(0, 20).map((aktivitaet: { id: string; typ: string; beschreibung: string; erstelltAm: string }) => (
                      <div key={aktivitaet.id} className="relative flex items-start gap-3">
                        {/* Dot mit Icon-Hintergrund */}
                        <div
                          className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            backgroundColor: 'var(--karte)',
                            border: '1.5px solid var(--rahmen)',
                          }}
                        >
                          {aktivitaetIcon(aktivitaet.typ)}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-semibold ax-titel">
                              {AKTIVITAET_BEZEICHNUNG[aktivitaet.typ] || aktivitaet.typ}
                            </span>
                            <span className="text-[11px] ax-text-tertiaer tabular-nums">
                              {new Date(aktivitaet.erstelltAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          {aktivitaet.beschreibung && (
                            <p className="text-xs ax-text-sekundaer leading-snug mt-1 break-words">
                              {aktivitaet.beschreibung}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Termine */}
            {lead.termine && lead.termine.length > 0 && (
              <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--rahmen-leicht)' }}>
                <h4 className="ax-label mb-3 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" strokeWidth={2.2} /> Termine
                </h4>
                <div className="space-y-2.5">
                  {lead.termine.map((termin: { id: string; titel: string; beginnAm: string; quelle?: string; meetingLink?: string | null }) => (
                    <div
                      key={termin.id}
                      className="rounded-xl p-3.5"
                      style={{
                        backgroundColor: 'var(--karte-erhoeht)',
                        border: '1px solid var(--rahmen-leicht)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold ax-titel leading-snug">
                          {termin.titel}
                        </span>
                        {termin.quelle && (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0"
                            style={{
                              backgroundColor: 'rgba(34, 197, 94, 0.12)',
                              color: '#15803d',
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                            }}
                          >
                            {termin.quelle}
                          </span>
                        )}
                      </div>
                      <p className="text-xs ax-text-sekundaer tabular-nums">
                        {new Date(termin.beginnAm).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      {termin.meetingLink && (
                        <a
                          href={termin.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-axano-orange hover:text-orange-700 dark:hover:text-orange-400 mt-2 inline-flex items-center gap-1 font-semibold transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" strokeWidth={2.2} /> Meeting beitreten
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notizen */}
            <div className="px-6 py-5">
              <h4 className="ax-label mb-3 flex items-center gap-1.5">
                <Send className="w-3 h-3" strokeWidth={2.2} /> Notizen
              </h4>
              {lead.notizen && lead.notizen.length > 0 ? (
                <div className="space-y-2.5 mb-4">
                  {lead.notizen.map((notiz: { id: string; inhalt: string; autor: { vorname: string; nachname: string } | null; erstelltAm: string }) => (
                    <div
                      key={notiz.id}
                      className="rounded-xl p-3.5"
                      style={{
                        backgroundColor: 'var(--karte-erhoeht)',
                        border: '1px solid var(--rahmen-leicht)',
                      }}
                    >
                      <p className="text-sm ax-titel leading-relaxed">{notiz.inhalt}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] ax-text-tertiaer">
                        <span className="font-medium">{notiz.autor ? `${notiz.autor.vorname} ${notiz.autor.nachname}` : 'System'}</span>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{new Date(notiz.erstelltAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm ax-text-tertiaer mb-4">Noch keine Notizen.</p>
              )}

              {/* Neue Notiz */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neueNotiz}
                  onChange={(e) => setNeueNotiz(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && notizAbsenden()}
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-lg ax-eingabe"
                  placeholder="Notiz hinzufügen…"
                />
                <button
                  onClick={notizAbsenden}
                  disabled={!neueNotiz.trim() || notizHinzufuegen.isPending}
                  aria-label="Notiz speichern"
                  className="text-white px-3 py-2.5 rounded-lg transition-all duration-200 ease-sanft disabled:opacity-40 active:scale-[0.97] ax-fokus-ring"
                  style={{
                    background: 'linear-gradient(135deg, #1a2b4c 0%, #2f3d5f 100%)',
                    boxShadow: '0 1px 3px rgba(26, 43, 76, 0.2)',
                  }}
                >
                  <Send className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
