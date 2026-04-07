'use client';

import { Calendar, Clock, User, Video } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Termin {
  id: string;
  titel: string;
  beschreibung?: string;
  beginnAm: string;
  endeAm?: string;
  quelle?: string;
  meetingLink?: string;
  lead?: { vorname?: string; nachname?: string; email?: string; telefon?: string } | null;
}

export default function KalenderSeite() {
  const { data: termine, isLoading } = useQuery({
    queryKey: ['termine'],
    queryFn: async () => {
      // Termine der nächsten 30 Tage laden
      const von = new Date().toISOString();
      const bis = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await apiClient.get(`/anrufe?typ=termine&von=${von}&bis=${bis}`);
      return (data.daten?.eintraege || data.daten || []) as Termin[];
    },
  });

  // Termine nach Tag gruppieren
  const terminNachTag = (termine || []).reduce<Record<string, Termin[]>>((acc, t) => {
    const tag = new Date(t.beginnAm).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(t);
    return acc;
  }, {});

  const tage = Object.keys(terminNachTag);

  return (
    <div className="animate-einblenden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">Kalender</h1>
        <p className="text-sm ax-text-sekundaer mt-1">
          Termine der nächsten 30 Tage
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : tage.length === 0 ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">Keine Termine</h3>
          <p className="text-sm ax-text-sekundaer">
            Termine werden automatisch erstellt wenn Leads über die KI-Telefonie einen Beratungstermin buchen.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {tage.map((tag) => (
            <div key={tag}>
              <h3 className="text-sm font-semibold ax-titel mb-3">{tag}</h3>
              <div className="space-y-2">
                {terminNachTag[tag].map((termin) => {
                  const beginn = new Date(termin.beginnAm);
                  const ende = termin.endeAm ? new Date(termin.endeAm) : null;
                  const leadName = [termin.lead?.vorname, termin.lead?.nachname].filter(Boolean).join(' ');

                  return (
                    <div key={termin.id} className="ax-karte rounded-xl p-4 flex items-start gap-4">
                      <div className="flex-shrink-0 w-16 text-center">
                        <p className="text-lg font-bold ax-titel">
                          {beginn.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {ende && (
                          <p className="text-xs ax-text-tertiaer">
                            bis {ende.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium ax-titel">{termin.titel}</p>
                        {leadName && (
                          <p className="text-xs ax-text-sekundaer flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" /> {leadName}
                            {termin.lead?.email && ` · ${termin.lead.email}`}
                          </p>
                        )}
                        {termin.beschreibung && (
                          <p className="text-xs ax-text-tertiaer mt-1">{termin.beschreibung}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {termin.quelle && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            termin.quelle === 'calendly' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : termin.quelle === 'google_calendar' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {termin.quelle === 'calendly' ? 'Calendly' : termin.quelle === 'google_calendar' ? 'Google' : 'Manuell'}
                          </span>
                        )}
                        {termin.meetingLink && (
                          <a href={termin.meetingLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-axano-orange hover:underline font-medium">
                            <Video className="w-3 h-3" /> Meeting
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
