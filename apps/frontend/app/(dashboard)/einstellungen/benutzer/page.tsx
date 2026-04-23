'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, KeyRound, Plus, Trash2, UserPlus, X } from 'lucide-react';
import {
  benutzeBenutzer,
  benutzeBenutzerAktualisieren,
  benutzeBenutzerErstellen,
  benutzeBenutzerLoeschen,
} from '@/hooks/benutze-benutzer';
import { benutzeKunden } from '@/hooks/benutze-kunden';
import { useToastStore } from '@/stores/toast-store';

type Rolle = 'admin' | 'mitarbeiter' | 'kunde';

export default function BenutzerSeite() {
  const { data: benutzer, isLoading } = benutzeBenutzer();
  const { data: kunden } = benutzeKunden({ ignoriereGlobalenFilter: true });
  const erstellen = benutzeBenutzerErstellen();
  const aktualisieren = benutzeBenutzerAktualisieren();
  const loeschen = benutzeBenutzerLoeschen();
  const { toastAnzeigen } = useToastStore();

  const [loeschBestaetigung, setLoeschBestaetigung] = useState<{ id: string; name: string; email: string } | null>(null);

  const [modalOffen, setModalOffen] = useState(false);
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [rolle, setRolle] = useState<Rolle>('mitarbeiter');
  const [kundeId, setKundeId] = useState('');
  const [fehler, setFehler] = useState('');
  const [zugangsDaten, setZugangsDaten] = useState<{ email: string; passwort: string; name: string; kunde?: string | null } | null>(null);

  const istKundenRolle = rolle === 'kunde';

  const zugangsDatenKopieren = async (daten: { email: string; passwort: string }) => {
    try {
      const text = `E-Mail: ${daten.email}\nPasswort: ${daten.passwort}`;
      await navigator.clipboard.writeText(text);
      toastAnzeigen('erfolg', 'Zugangsdaten kopiert');
    } catch {
      toastAnzeigen('fehler', 'Kopieren fehlgeschlagen');
    }
  };

  const benutzerLoeschen = async () => {
    if (!loeschBestaetigung) return;
    try {
      await loeschen.mutateAsync(loeschBestaetigung.id);
      toastAnzeigen('erfolg', `${loeschBestaetigung.name} wurde geloescht`);
      setLoeschBestaetigung(null);
    } catch (f: unknown) {
      const nachricht = (f as { response?: { data?: { fehler?: string } } })?.response?.data?.fehler;
      toastAnzeigen('fehler', nachricht || 'Loeschen fehlgeschlagen');
    }
  };

  const zuruecksetzen = () => {
    setVorname('');
    setNachname('');
    setEmail('');
    setPasswort('');
    setRolle('mitarbeiter');
    setKundeId('');
    setFehler('');
  };

  const absenden = async () => {
    setFehler('');

    if (!vorname || !nachname || !email) {
      setFehler('Vorname, Nachname und E-Mail sind erforderlich');
      return;
    }
    if (passwort.length < 8) {
      setFehler('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    if (istKundenRolle && !kundeId) {
      setFehler('Bitte einen Kunden zuordnen');
      return;
    }

    try {
      await erstellen.mutateAsync({
        vorname,
        nachname,
        email,
        passwort,
        rolle,
        ...(istKundenRolle ? { kundeId } : {}),
      });
      const kundenName = istKundenRolle ? (kunden?.eintraege?.find((k) => k.id === kundeId)?.name ?? null) : null;
      toastAnzeigen('erfolg', istKundenRolle ? 'Kunden-Zugang angelegt' : 'Benutzer erstellt');
      setZugangsDaten({ email, passwort, name: `${vorname} ${nachname}`, kunde: kundenName });
      setModalOffen(false);
      zuruecksetzen();
    } catch (f: unknown) {
      const nachricht = (f as { response?: { data?: { fehler?: string } } })?.response?.data?.fehler;
      setFehler(nachricht || 'Fehler beim Erstellen des Benutzers');
    }
  };

  const rolleAnzeige = (r: string) =>
    r === 'admin' ? 'Admin' : r === 'kunde' ? 'Kunde' : 'Mitarbeiter';

  const rolleFarbe = (r: string) => {
    if (r === 'admin') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (r === 'kunde') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  };

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">Benutzerverwaltung</h1>
          <p className="text-sm ax-text-sekundaer mt-1">Axano-Team und Kunden-Zugaenge verwalten</p>
        </div>
        <button
          onClick={() => setModalOffen(true)}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neuer Benutzer
        </button>
      </div>

      {zugangsDaten && (
        <div className="mb-5 ax-karte border-l-4 border-axano-orange rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-axano-orange/10 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-4 h-4 text-axano-orange" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold ax-titel">
                Zugang fuer {zugangsDaten.name}{zugangsDaten.kunde ? ` (${zugangsDaten.kunde})` : ''} angelegt
              </p>
              <p className="text-xs ax-text-sekundaer mt-1">
                Gib diese Zugangsdaten dem Benutzer persoenlich weiter (Chat, WhatsApp, Telefon).
                Das Passwort wird nur einmal angezeigt — danach ist es nicht mehr sichtbar.
              </p>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mt-3 text-xs">
                <span className="ax-text-sekundaer">E-Mail:</span>
                <code className="ax-text font-medium">{zugangsDaten.email}</code>
                <span className="ax-text-sekundaer">Passwort:</span>
                <code className="ax-text font-medium">{zugangsDaten.passwort}</code>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => zugangsDatenKopieren({ email: zugangsDaten.email, passwort: zugangsDaten.passwort })}
                  className="flex items-center gap-1 text-xs bg-axano-orange hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-all"
                >
                  <Copy className="w-3 h-3" strokeWidth={2.2} />
                  Zugangsdaten kopieren
                </button>
              </div>
            </div>
            <button onClick={() => setZugangsDaten(null)} className="p-1 ax-text-tertiaer hover:ax-text">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : (
        <div className="ax-karte rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b ax-rahmen-leicht">
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-5 py-3">E-Mail</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-5 py-3">Rolle</th>
                <th className="text-left text-xs font-semibold ax-text-sekundaer uppercase px-5 py-3">Status</th>
                <th className="text-right text-xs font-semibold ax-text-sekundaer uppercase px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {benutzer?.map((b) => (
                <tr key={b.id} className="border-b ax-rahmen-leicht last:border-0">
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium ax-titel">
                      {b.vorname} {b.nachname}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm ax-text-sekundaer">{b.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rolleFarbe(b.rolle)}`}>
                      {rolleAnzeige(b.rolle)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      b.aktiv ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {b.aktiv ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      {b.aktiv ? (
                        <button
                          onClick={() => aktualisieren.mutate({ id: b.id, aktiv: false })}
                          className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                        >
                          Deaktivieren
                        </button>
                      ) : (
                        <button
                          onClick={() => aktualisieren.mutate({ id: b.id, aktiv: true })}
                          className="text-xs text-green-500 hover:text-green-700 font-medium"
                        >
                          Aktivieren
                        </button>
                      )}
                      <button
                        onClick={() => setLoeschBestaetigung({ id: b.id, name: `${b.vorname} ${b.nachname}`, email: b.email })}
                        className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                        title="Benutzer endgueltig loeschen"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={2.2} />
                        Loeschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOffen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setModalOffen(false)} />
          <div className="relative ax-karte rounded-xl shadow-xl w-full max-w-md m-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold ax-titel flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> {istKundenRolle ? 'Kunden-Zugang anlegen' : 'Neuer Benutzer'}
              </h2>
              <button onClick={() => setModalOffen(false)} className="p-1 ax-text-tertiaer hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {fehler && <div className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm rounded-lg p-3 mb-4">{fehler}</div>}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={vorname} onChange={(e) => setVorname(e.target.value)} placeholder="Vorname" className="px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
                <input value={nachname} onChange={(e) => setNachname(e.target.value)} placeholder="Nachname" className="px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
              </div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-Mail" className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe" />

              <select
                value={rolle}
                onChange={(e) => setRolle(e.target.value as Rolle)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              >
                <option value="mitarbeiter">Mitarbeiter (Axano-Team)</option>
                <option value="admin">Administrator (Axano-Team)</option>
                <option value="kunde">Kunde (Self-Service-Zugang)</option>
              </select>

              {istKundenRolle && (
                <div className="space-y-2">
                  <select
                    value={kundeId}
                    onChange={(e) => setKundeId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                  >
                    <option value="">— Kunde auswaehlen —</option>
                    {kunden?.eintraege?.map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <input
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                type="text"
                placeholder="Passwort (min. 8 Zeichen)"
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe font-mono"
              />

              {istKundenRolle && (
                <p className="text-xs ax-text-tertiaer leading-relaxed">
                  Der Zugang wird sofort aktiviert. Gib dem Kunden E-Mail und Passwort persoenlich weiter —
                  er sieht nach dem Login ausschliesslich seine eigenen Integrationen.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModalOffen(false)} className="border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg text-sm">Abbrechen</button>
              <button
                onClick={absenden}
                disabled={erstellen.isPending}
                className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {istKundenRolle ? 'Zugang anlegen' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loeschBestaetigung && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setLoeschBestaetigung(null)} />
          <div className="relative ax-karte rounded-xl shadow-xl w-full max-w-md m-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <h2 className="font-bold ax-titel">Benutzer endgueltig loeschen?</h2>
                <p className="text-sm ax-text-sekundaer mt-1">
                  <strong>{loeschBestaetigung.name}</strong> ({loeschBestaetigung.email}) wird unwiderruflich entfernt.
                  Zugewiesene Leads und erstellte Kampagnen bleiben erhalten, verlieren aber die Personen-Zuordnung.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setLoeschBestaetigung(null)}
                className="border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg text-sm"
              >
                Abbrechen
              </button>
              <button
                onClick={benutzerLoeschen}
                disabled={loeschen.isPending}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                Endgueltig loeschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
