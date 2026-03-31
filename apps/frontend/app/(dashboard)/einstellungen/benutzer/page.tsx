'use client';

import { useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import { benutzeBenutzer, benutzeBenutzerErstellen, benutzeBenutzerAktualisieren } from '@/hooks/benutze-benutzer';

export default function BenutzerSeite() {
  const { data: benutzer, isLoading } = benutzeBenutzer();
  const erstellen = benutzeBenutzerErstellen();
  const aktualisieren = benutzeBenutzerAktualisieren();
  const [modalOffen, setModalOffen] = useState(false);
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [rolle, setRolle] = useState('mitarbeiter');
  const [fehler, setFehler] = useState('');

  const absenden = async () => {
    setFehler('');
    if (!vorname || !nachname || !email || !passwort) {
      setFehler('Alle Felder sind erforderlich');
      return;
    }
    try {
      await erstellen.mutateAsync({ vorname, nachname, email, passwort, rolle });
      setModalOffen(false);
      setVorname(''); setNachname(''); setEmail(''); setPasswort(''); setRolle('mitarbeiter');
    } catch {
      setFehler('Fehler beim Erstellen des Benutzers');
    }
  };

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">Benutzerverwaltung</h1>
          <p className="text-sm ax-text-sekundaer mt-1">Benutzer verwalten</p>
        </div>
        <button
          onClick={() => setModalOffen(true)}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neuer Benutzer
        </button>
      </div>

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
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      b.rolle === 'admin' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {b.rolle === 'admin' ? 'Admin' : 'Mitarbeiter'}
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
                    {b.aktiv ? (
                      <button
                        onClick={() => aktualisieren.mutate({ id: b.id, aktiv: false })}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Neuer Benutzer Modal */}
      {modalOffen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setModalOffen(false)} />
          <div className="relative ax-karte rounded-xl shadow-xl w-full max-w-md m-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold ax-titel flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Neuer Benutzer
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
              <input value={passwort} onChange={(e) => setPasswort(e.target.value)} type="password" placeholder="Passwort (min. 8 Zeichen)" className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
              <select value={rolle} onChange={(e) => setRolle(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe">
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModalOffen(false)} className="border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg text-sm">Abbrechen</button>
              <button onClick={absenden} disabled={erstellen.isPending} className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
