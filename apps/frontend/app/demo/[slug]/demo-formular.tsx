'use client';

import { useState, useEffect } from 'react';
import { Phone, PhoneCall } from 'lucide-react';

export interface KampagnenFeldMeta {
  id: string;
  feldname: string;
  bezeichnung: string;
  feldtyp: 'text' | 'zahl' | 'email' | 'telefon' | 'datum' | 'auswahl' | 'ja_nein' | 'mehrzeilig';
  pflichtfeld: boolean;
  optionen: unknown; // JSON: string[] bei feldtyp='auswahl'
  reihenfolge: number;
  platzhalter: string | null;
  hilfetext: string | null;
}

type Zustand = 'eingabe' | 'sendet' | 'wartet' | 'timeout' | 'fehler';

interface Props {
  slug: string;
  felder: KampagnenFeldMeta[];
}

export function DemoFormular({ slug, felder }: Props) {
  const [zustand, setZustand] = useState<Zustand>('eingabe');
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('+49 ');
  const [felddaten, setFelddaten] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [fehler, setFehler] = useState('');

  // Nach 45 Sek Timeout-Hinweis anzeigen
  useEffect(() => {
    if (zustand !== 'wartet') return;
    const t = setTimeout(() => setZustand('timeout'), 45000);
    return () => clearTimeout(t);
  }, [zustand]);

  const feldAendern = (feldname: string, wert: string) => {
    setFelddaten((prev) => ({ ...prev, [feldname]: wert }));
  };

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler('');

    if (!vorname.trim() || !nachname.trim()) {
      setFehler('Bitte gib Vor- und Nachnamen ein');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFehler('Bitte gib eine gueltige E-Mail-Adresse ein');
      return;
    }
    if (telefon.replace(/\D/g, '').length < 8) {
      setFehler('Bitte gib eine gueltige Telefonnummer ein');
      return;
    }

    // Pflichtfelder pruefen
    const fehlendeListe = felder
      .filter((f) => f.pflichtfeld && !(felddaten[f.feldname] || '').trim())
      .map((f) => f.bezeichnung);
    if (fehlendeListe.length > 0) {
      setFehler(`Bitte fuelle alle Pflichtfelder aus: ${fehlendeListe.join(', ')}`);
      return;
    }

    setZustand('sendet');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const antwort = await fetch(`${apiUrl}/demo/${encodeURIComponent(slug)}/anrufen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          email: email.trim(),
          telefon: telefon.trim(),
          felddaten,
          _hp: honeypot || undefined,
        }),
      });

      const ergebnis = await antwort.json();
      if (!ergebnis.erfolg) {
        setFehler(ergebnis.fehler || 'Anruf konnte nicht gestartet werden');
        setZustand('fehler');
        return;
      }

      setZustand('wartet');
    } catch {
      setFehler('Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.');
      setZustand('fehler');
    }
  };

  const zuruecksetzen = () => {
    setZustand('eingabe');
    setFehler('');
  };

  if (zustand === 'wartet' || zustand === 'timeout') {
    return (
      <div className="text-center py-6">
        <div className="relative w-24 h-24 mx-auto mb-6">
          {zustand === 'wartet' && (
            <>
              <div className="absolute inset-0 rounded-full bg-axano-orange/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-axano-orange/30 animate-ping" style={{ animationDelay: '0.5s' }} />
            </>
          )}
          <div className="relative w-24 h-24 rounded-full bg-axano-orange flex items-center justify-center">
            <PhoneCall className="w-10 h-10 text-white" strokeWidth={2.2} />
          </div>
        </div>

        {zustand === 'wartet' ? (
          <>
            <h3 className="text-lg font-bold ax-titel mb-2">Dein Handy klingelt gleich</h3>
            <p className="text-sm ax-text-sekundaer mb-4">
              Bitte halte dein Telefon bereit. Der Anruf startet in wenigen Sekunden.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold ax-titel mb-2">Hat&apos;s nicht geklingelt?</h3>
            <p className="text-sm ax-text-sekundaer mb-4">
              Pruefe bitte deinen Netzempfang und ob die Nummer korrekt ist.
              Du kannst die Demo jederzeit neu starten.
            </p>
          </>
        )}

        <button
          onClick={zuruecksetzen}
          className="text-sm border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg transition-all ax-hover"
        >
          Neue Demo starten
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      {fehler && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg p-3">
          {fehler}
        </div>
      )}

      {/* Standardfelder */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium ax-text">Vorname</label>
          <input
            type="text"
            value={vorname}
            onChange={(e) => setVorname(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
            placeholder="Max"
            autoComplete="given-name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium ax-text">Nachname</label>
          <input
            type="text"
            value={nachname}
            onChange={(e) => setNachname(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
            placeholder="Mustermann"
            autoComplete="family-name"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium ax-text">E-Mail-Adresse</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
          placeholder="max@example.de"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium ax-text">Telefonnummer</label>
        <input
          type="tel"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
          className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
          placeholder="+49 151 12345678"
          autoComplete="tel"
          required
        />
      </div>

      {/* Kampagnen-Felder (dynamisch) */}
      {felder.length > 0 && (
        <div className="pt-4 mt-2 border-t ax-rahmen-leicht space-y-4">
          <div>
            <h3 className="text-sm font-semibold ax-titel">Zusaetzliche Angaben</h3>
            <p className="text-xs ax-text-sekundaer mt-0.5">
              Die KI wird dir diese Angaben im Anruf bestaetigen. Fuelle sie so aus, wie es fuer einen echten Lead passen wuerde.
            </p>
          </div>

          {felder.map((feld) => (
            <FeldRenderer
              key={feld.id}
              feld={feld}
              wert={felddaten[feld.feldname] || ''}
              onAendern={(w) => feldAendern(feld.feldname, w)}
            />
          ))}
        </div>
      )}

      {/* Honeypot */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}>
        <label>
          Bitte nicht ausfuellen
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={zustand === 'sendet'}
        className="w-full bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {zustand === 'sendet' ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Starte Anruf...
          </>
        ) : (
          <>
            <Phone className="w-4 h-4" strokeWidth={2.2} />
            Jetzt anrufen lassen
          </>
        )}
      </button>

      <p className="text-xs ax-text-tertiaer leading-relaxed">
        Mit Klick erlaubst du der KI, dich sofort unter dieser Nummer anzurufen.
        Deine Daten werden nur fuer diesen Demo-Anruf verwendet.
      </p>
    </form>
  );
}

function FeldRenderer({
  feld,
  wert,
  onAendern,
}: {
  feld: KampagnenFeldMeta;
  wert: string;
  onAendern: (wert: string) => void;
}) {
  const label = (
    <label className="text-sm font-medium ax-text">
      {feld.bezeichnung}
      {!feld.pflichtfeld && <span className="ax-text-tertiaer font-normal"> (optional)</span>}
    </label>
  );

  const hilfe = feld.hilfetext ? (
    <p className="text-xs ax-text-tertiaer mt-1">{feld.hilfetext}</p>
  ) : null;

  const basisKlasse = 'w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe';

  switch (feld.feldtyp) {
    case 'mehrzeilig':
      return (
        <div className="space-y-1.5">
          {label}
          <textarea
            value={wert}
            onChange={(e) => onAendern(e.target.value)}
            className={`${basisKlasse} min-h-[80px]`}
            placeholder={feld.platzhalter || ''}
            required={feld.pflichtfeld}
          />
          {hilfe}
        </div>
      );

    case 'ja_nein':
      return (
        <div className="space-y-1.5">
          {label}
          <div className="flex gap-3">
            {['Ja', 'Nein'].map((opt) => (
              <label
                key={opt}
                className={`flex-1 cursor-pointer px-3 py-2.5 text-sm rounded-lg border transition-all text-center ${
                  wert === opt
                    ? 'bg-axano-orange/10 border-axano-orange text-axano-orange font-semibold'
                    : 'ax-rahmen-leicht ax-text ax-hover'
                }`}
              >
                <input
                  type="radio"
                  name={feld.feldname}
                  value={opt}
                  checked={wert === opt}
                  onChange={(e) => onAendern(e.target.value)}
                  required={feld.pflichtfeld}
                  className="sr-only"
                />
                {opt}
              </label>
            ))}
          </div>
          {hilfe}
        </div>
      );

    case 'auswahl': {
      const optionen = Array.isArray(feld.optionen) ? (feld.optionen as string[]) : [];
      return (
        <div className="space-y-1.5">
          {label}
          <select
            value={wert}
            onChange={(e) => onAendern(e.target.value)}
            className={basisKlasse}
            required={feld.pflichtfeld}
          >
            <option value="">— Bitte waehlen —</option>
            {optionen.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {hilfe}
        </div>
      );
    }

    case 'datum':
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="date"
            value={wert}
            onChange={(e) => onAendern(e.target.value)}
            className={basisKlasse}
            required={feld.pflichtfeld}
          />
          {hilfe}
        </div>
      );

    case 'zahl':
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="number"
            value={wert}
            onChange={(e) => onAendern(e.target.value)}
            className={basisKlasse}
            placeholder={feld.platzhalter || ''}
            required={feld.pflichtfeld}
          />
          {hilfe}
        </div>
      );

    case 'email':
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="email"
            value={wert}
            onChange={(e) => onAendern(e.target.value)}
            className={basisKlasse}
            placeholder={feld.platzhalter || ''}
            required={feld.pflichtfeld}
          />
          {hilfe}
        </div>
      );

    case 'telefon':
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="tel"
            value={wert}
            onChange={(e) => onAendern(e.target.value)}
            className={basisKlasse}
            placeholder={feld.platzhalter || ''}
            required={feld.pflichtfeld}
          />
          {hilfe}
        </div>
      );

    case 'text':
    default:
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="text"
            value={wert}
            onChange={(e) => onAendern(e.target.value)}
            className={basisKlasse}
            placeholder={feld.platzhalter || ''}
            required={feld.pflichtfeld}
          />
          {hilfe}
        </div>
      );
  }
}
