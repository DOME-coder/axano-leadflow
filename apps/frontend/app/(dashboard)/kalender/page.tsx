'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, User, Video, Phone, Mail, Building2, Megaphone, ExternalLink, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useUiStore } from '@/stores/ui-store';
import { statusFarbeErmitteln } from '@/lib/typen';
import { LeerZustand } from '@/components/ui/leer-zustand';

type ZeitraumKey = 'anstehend' | 'diese-woche' | 'vergangen' | 'alle';

interface ZeitraumKonfig {
  label: string;
  beschreibung: string;
  berechnen: () => { von?: string; bis?: string; sortierung: 'asc' | 'desc' };
}

const MS_PRO_TAG = 24 * 60 * 60 * 1000;

const ZEITRAEUME: Record<ZeitraumKey, ZeitraumKonfig> = {
  anstehend: {
    label: 'Anstehend',
    beschreibung: 'Nächste 30 Tage',
    berechnen: () => ({
      von: new Date().toISOString(),
      bis: new Date(Date.now() + 30 * MS_PRO_TAG).toISOString(),
      sortierung: 'asc',
    }),
  },
  'diese-woche': {
    label: 'Diese Woche',
    beschreibung: '±7 Tage',
    berechnen: () => ({
      von: new Date(Date.now() - 7 * MS_PRO_TAG).toISOString(),
      bis: new Date(Date.now() + 7 * MS_PRO_TAG).toISOString(),
      sortierung: 'asc',
    }),
  },
  vergangen: {
    label: 'Vergangen',
    beschreibung: 'Letzte 60 Tage',
    berechnen: () => ({
      von: new Date(Date.now() - 60 * MS_PRO_TAG).toISOString(),
      bis: new Date().toISOString(),
      sortierung: 'desc',
    }),
  },
  alle: {
    label: 'Alle',
    beschreibung: 'Ohne Zeitfilter',
    berechnen: () => ({ sortierung: 'desc' }),
  },
};

interface TerminKalender {
  id: string;
  titel: string;
  beschreibung?: string | null;
  beginnAm: string;
  endeAm?: string | null;
  quelle?: 'calendly' | 'google_calendar' | 'manuell' | null;
  meetingLink?: string | null;
  lead?: {
    id: string;
    vorname?: string | null;
    nachname?: string | null;
    email?: string | null;
    telefon?: string | null;
    status: string;
    kampagneId?: string | null;
    kampagne?: {
      id: string;
      name: string;
      kunde?: { id: string; name: string } | null;
    } | null;
  } | null;
}

const QUELLEN_LABEL: Record<string, string> = {
  calendly: 'Calendly',
  google_calendar: 'Google Calendar',
  manuell: 'Manuell',
};

const QUELLEN_FARBE: Record<string, string> = {
  calendly: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  google_calendar: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50',
  manuell: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

export default function KalenderSeite() {
  const kundeId = useUiStore((s) => s.ausgewaehlterKundeId);
  const [zeitraum, setZeitraum] = useState<ZeitraumKey>('anstehend');

  const { data: termine, isLoading } = useQuery({
    queryKey: ['termine', kundeId, zeitraum],
    queryFn: async () => {
      const { von, bis, sortierung } = ZEITRAEUME[zeitraum].berechnen();
      const params = new URLSearchParams();
      if (von) params.set('von', von);
      if (bis) params.set('bis', bis);
      params.set('sortierung', sortierung);
      if (kundeId) params.set('kundeId', kundeId);
      const { data } = await apiClient.get(`/termine?${params.toString()}`);
      return (data.daten?.eintraege || []) as TerminKalender[];
    },
  });

  // Nach Tag gruppieren
  const terminNachTag = (termine || []).reduce<Record<string, TerminKalender[]>>((acc, t) => {
    const datum = new Date(t.beginnAm);
    const tag = datum.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(t);
    return acc;
  }, {});

  const tage = Object.keys(terminNachTag);
  const jetzt = new Date();
  const heuteStr = jetzt.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const morgen = new Date(jetzt);
  morgen.setDate(morgen.getDate() + 1);
  const morgenStr = morgen.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function tagLabel(tagString: string): { haupt: string; zusatz: string | null } {
    if (tagString === heuteStr) return { haupt: 'Heute', zusatz: tagString };
    if (tagString === morgenStr) return { haupt: 'Morgen', zusatz: tagString };
    const [wochentag, rest] = tagString.split(', ');
    return { haupt: wochentag, zusatz: rest };
  }

  const aktiverZeitraum = ZEITRAEUME[zeitraum];
  const anzahlText = termine && termine.length > 0
    ? `${termine.length} Termin${termine.length === 1 ? '' : 'e'}`
    : 'Keine Termine';

  return (
    <div className="animate-einblenden">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="ax-ueberschrift-1">Kalender</h1>
          <p className="text-sm ax-text-sekundaer mt-1.5">
            {anzahlText} · {aktiverZeitraum.beschreibung}
          </p>
        </div>
      </div>

      {/* Zeitraum-Chips */}
      <div
        className="inline-flex items-center gap-1 mb-7 p-1 rounded-xl"
        style={{
          backgroundColor: 'var(--karte-erhoeht)',
          border: '1px solid var(--rahmen-leicht)',
        }}
        role="tablist"
        aria-label="Zeitraum wählen"
      >
        {(Object.keys(ZEITRAEUME) as ZeitraumKey[]).map((key) => {
          const aktiv = key === zeitraum;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={aktiv}
              onClick={() => setZeitraum(key)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-sanft ax-fokus-ring ${
                aktiv
                  ? 'ax-titel'
                  : 'ax-text-sekundaer hover:ax-text'
              }`}
              style={
                aktiv
                  ? {
                      backgroundColor: 'var(--karte)',
                      boxShadow: 'var(--schatten-sm)',
                    }
                  : undefined
              }
            >
              {ZEITRAEUME[key].label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      ) : tage.length === 0 ? (
        <LeerZustand
          icon={CalendarIcon}
          titel={
            zeitraum === 'vergangen'
              ? 'Keine Termine in den letzten 60 Tagen'
              : zeitraum === 'diese-woche'
                ? 'Keine Termine in dieser Woche'
                : zeitraum === 'alle'
                  ? 'Noch keine Termine vorhanden'
                  : 'Keine anstehenden Termine in den nächsten 30 Tagen'
          }
          beschreibung={
            zeitraum === 'vergangen'
              ? 'In diesem Zeitraum wurden keine Termine gebucht. Wechsle auf einen anderen Zeitraum, um mehr zu sehen.'
              : 'Termine erscheinen hier automatisch, sobald Leads über Calendly einen Termin buchen oder die KI einen vereinbart.'
          }
        />
      ) : (
        <div className="space-y-8">
          {tage.map((tag) => {
            const label = tagLabel(tag);
            return (
              <div key={tag}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h3 className="ax-ueberschrift-3">{label.haupt}</h3>
                  {label.zusatz && (
                    <p className="text-xs ax-text-tertiaer tabular-nums">{label.zusatz}</p>
                  )}
                </div>
                <div className="space-y-2.5">
                  {terminNachTag[tag].map((termin) => (
                    <TerminKarte key={termin.id} termin={termin} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TerminKarte({ termin }: { termin: TerminKalender }) {
  const beginn = new Date(termin.beginnAm);
  const ende = termin.endeAm ? new Date(termin.endeAm) : null;
  const lead = termin.lead;
  const leadName = lead ? [lead.vorname, lead.nachname].filter(Boolean).join(' ').trim() : '';
  const kampagne = lead?.kampagne;
  const kunde = kampagne?.kunde;

  const dauerMinuten = ende
    ? Math.round((ende.getTime() - beginn.getTime()) / 60000)
    : null;

  const quelleKey = termin.quelle || 'manuell';
  const quelleFarbe = QUELLEN_FARBE[quelleKey] || QUELLEN_FARBE.manuell;
  const quelleLabel = QUELLEN_LABEL[quelleKey] || 'Manuell';

  return (
    <div className="ax-karte-interaktiv rounded-xl p-5 flex items-start gap-5">
      {/* Uhrzeit-Spalte links */}
      <div className="flex-shrink-0 w-20 text-center">
        <p className="text-2xl font-bold ax-titel tabular-nums leading-none">
          {beginn.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {ende && (
          <p className="text-[11px] ax-text-tertiaer mt-1 tabular-nums flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={2} />
            {ende.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            {dauerMinuten !== null && ` · ${dauerMinuten} Min`}
          </p>
        )}
      </div>

      {/* Mittelbalken */}
      <div className="flex-1 min-w-0">
        {/* Titel + Kampagne/Kunde */}
        <div className="mb-2">
          <h4 className="text-sm font-semibold ax-titel leading-snug">{termin.titel}</h4>
          {(kampagne || kunde) && (
            <div className="flex items-center gap-2.5 mt-1.5 text-[11px] ax-text-sekundaer flex-wrap">
              {kunde && (
                <Link
                  href={`/kunden/${kunde.id}`}
                  className="flex items-center gap-1 hover:text-axano-orange transition-colors duration-200"
                >
                  <Building2 className="w-3 h-3" strokeWidth={2} />
                  {kunde.name}
                </Link>
              )}
              {kampagne && (
                <>
                  {kunde && <span aria-hidden className="ax-text-tertiaer">·</span>}
                  <Link
                    href={`/kampagnen/${kampagne.id}/leads`}
                    className="flex items-center gap-1 hover:text-axano-orange transition-colors duration-200"
                  >
                    <Megaphone className="w-3 h-3" strokeWidth={2} />
                    {kampagne.name}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {/* Lead-Details */}
        {lead && (
          <div
            className="rounded-lg p-3 mb-2"
            style={{
              backgroundColor: 'var(--karte-erhoeht)',
              border: '1px solid var(--rahmen-leicht)',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <User className="w-3.5 h-3.5 ax-text-tertiaer flex-shrink-0" strokeWidth={2} />
              <Link
                href={`/kampagnen/${lead.kampagneId}/leads?leadId=${lead.id}`}
                className="text-sm font-semibold ax-titel hover:text-axano-orange transition-colors duration-200"
              >
                {leadName || 'Unbekannter Lead'}
              </Link>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusFarbeErmitteln(lead.status)}`}>
                {lead.status}
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap text-[11px] ax-text-sekundaer">
              {lead.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-3 h-3 ax-text-tertiaer" strokeWidth={2} />
                  <span className="truncate max-w-[16rem]">{lead.email}</span>
                </div>
              )}
              {lead.telefon && (
                <div className="flex items-center gap-1 tabular-nums">
                  <Phone className="w-3 h-3 ax-text-tertiaer" strokeWidth={2} />
                  {lead.telefon}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Beschreibung */}
        {termin.beschreibung && (
          <p className="text-xs ax-text-sekundaer leading-relaxed whitespace-pre-wrap">
            {termin.beschreibung}
          </p>
        )}
      </div>

      {/* Rechte Spalte: Quelle + Meeting-Link */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {termin.quelle && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border ${quelleFarbe}`}
          >
            {quelleLabel}
          </span>
        )}
        {termin.meetingLink && (
          <a
            href={termin.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-axano-orange hover:text-orange-700 dark:hover:text-orange-400 font-semibold transition-colors duration-200"
          >
            <Video className="w-3.5 h-3.5" strokeWidth={2.2} /> Meeting
            <ExternalLink className="w-3 h-3 opacity-70" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}
