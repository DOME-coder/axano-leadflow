'use client';

import { useState, useEffect } from 'react';
import { Save, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export default function ProfilSeite() {
  const { benutzer, benutzerSetzen } = useAuthStore();
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [erfolg, setErfolg] = useState('');
  const [fehler, setFehler] = useState('');

  const [altesPasswort, setAltesPasswort] = useState('');
  const [neuesPasswort, setNeuesPasswort] = useState('');
  const [passwortErfolg, setPasswortErfolg] = useState('');
  const [passwortFehler, setPasswortFehler] = useState('');

  useEffect(() => {
    if (benutzer) {
      setVorname(benutzer.vorname);
      setNachname(benutzer.nachname);
      setEmail(benutzer.email);
    }
  }, [benutzer]);

  const profilSpeichern = async () => {
    setErfolg(''); setFehler('');
    try {
      const { data } = await apiClient.patch('/benutzer/profil', { vorname, nachname, email });
      benutzerSetzen(data.daten);
      setErfolg('Profil erfolgreich gespeichert');
    } catch {
      setFehler('Fehler beim Speichern');
    }
  };

  const passwortAendern = async () => {
    setPasswortErfolg(''); setPasswortFehler('');
    if (neuesPasswort.length < 8) {
      setPasswortFehler('Neues Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    try {
      await apiClient.patch('/benutzer/passwort', { altesPasswort, neuesPasswort });
      setPasswortErfolg('Passwort erfolgreich geändert');
      setAltesPasswort(''); setNeuesPasswort('');
    } catch {
      setPasswortFehler('Altes Passwort ist falsch');
    }
  };

  return (
    <div className="animate-einblenden max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">Profil</h1>
        <p className="text-sm ax-text-sekundaer mt-1">Eigene Daten bearbeiten</p>
      </div>

      {/* Profildaten */}
      <div className="ax-karte rounded-xl p-6 mb-4">
        <h3 className="font-semibold ax-titel text-sm mb-4">Persönliche Daten</h3>

        {erfolg && <div className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-sm rounded-lg p-3 mb-4">{erfolg}</div>}
        {fehler && <div className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm rounded-lg p-3 mb-4">{fehler}</div>}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Vorname</label>
              <input value={vorname} onChange={(e) => setVorname(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Nachname</label>
              <input value={nachname} onChange={(e) => setNachname(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium ax-text">E-Mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
          </div>
          <button onClick={profilSpeichern} className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2">
            <Save className="w-4 h-4" /> Speichern
          </button>
        </div>
      </div>

      {/* Passwort ändern */}
      <div className="ax-karte rounded-xl p-6">
        <h3 className="font-semibold ax-titel text-sm mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Passwort ändern
        </h3>

        {passwortErfolg && <div className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-sm rounded-lg p-3 mb-4">{passwortErfolg}</div>}
        {passwortFehler && <div className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm rounded-lg p-3 mb-4">{passwortFehler}</div>}

        <div className="space-y-3">
          <input value={altesPasswort} onChange={(e) => setAltesPasswort(e.target.value)} type="password" placeholder="Altes Passwort" className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
          <input value={neuesPasswort} onChange={(e) => setNeuesPasswort(e.target.value)} type="password" placeholder="Neues Passwort (min. 8 Zeichen)" className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe" />
          <button onClick={passwortAendern} className="bg-axano-primaer hover:bg-axano-sekundaer text-white font-semibold px-5 py-2.5 rounded-lg text-sm">
            Passwort ändern
          </button>
        </div>
      </div>
    </div>
  );
}
