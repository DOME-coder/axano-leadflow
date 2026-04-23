'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Provider-Presets fuer gaengige deutsche/europaeische E-Mail-Anbieter.
 * Der Kunde waehlt seinen Provider, gibt nur E-Mail + Passwort ein — Host/Port
 * werden automatisch gesetzt. Fuer "custom" werden die technischen Felder
 * wieder eingeblendet (Fallback fuer eigene Mail-Server).
 */
interface ProviderPreset {
  schluessel: string;
  label: string;
  host: string;
  port: string;
  /** Zusaetzlicher Hinweis, der unter dem Passwort-Feld angezeigt wird. */
  hinweis?: string;
  hinweisLink?: { text: string; url: string };
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    schluessel: 'gmail',
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: '587',
    hinweis:
      'Bei Gmail brauchst du ein 16-stelliges App-Passwort — nicht dein normales Google-Passwort. Dafuer muss 2-Faktor-Authentifizierung aktiv sein.',
    hinweisLink: { text: 'App-Passwort erstellen', url: 'https://myaccount.google.com/apppasswords' },
  },
  {
    schluessel: 'outlook',
    label: 'Outlook / Office 365',
    host: 'smtp.office365.com',
    port: '587',
    hinweis:
      'Bei Microsoft-Konten mit 2-Faktor-Authentifizierung brauchst du ein App-Passwort.',
    hinweisLink: { text: 'App-Passwort erstellen', url: 'https://account.microsoft.com/security' },
  },
  { schluessel: 'ionos', label: 'IONOS (1&1)', host: 'smtp.ionos.de', port: '587' },
  { schluessel: 'strato', label: 'Strato', host: 'smtp.strato.de', port: '587' },
  { schluessel: 'gmx', label: 'GMX', host: 'mail.gmx.net', port: '587' },
  { schluessel: 'webde', label: 'Web.de', host: 'smtp.web.de', port: '587' },
  { schluessel: 'yahoo', label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: '587' },
  { schluessel: 'telekom', label: 'T-Online (Telekom)', host: 'securesmtp.t-online.de', port: '587' },
  { schluessel: 'mailde', label: 'Mail.de', host: 'smtp.mail.de', port: '587' },
  { schluessel: 'custom', label: 'Benutzerdefiniert (eigener Server)', host: '', port: '587' },
];

interface Props {
  formKonfig: Record<string, string>;
  setFormKonfig: (neu: Record<string, string>) => void;
}

/**
 * Leitet den Anzeigenamen aus der E-Mail ab: "max.mustermann@gmail.com" → "Max Mustermann".
 */
function absenderNameAusEmail(email: string): string {
  const localTeil = email.split('@')[0] || '';
  return localTeil
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((wort) => wort.charAt(0).toUpperCase() + wort.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Ermittelt den Provider-Schluessel basierend auf vorhandener Konfiguration.
 * Nuetzlich wenn der Kunde eine bestehende Konfiguration bearbeitet.
 */
function providerAusHost(host: string): string {
  if (!host) return 'gmail';
  const treffer = PROVIDER_PRESETS.find((p) => p.host && p.host.toLowerCase() === host.toLowerCase());
  return treffer?.schluessel || 'custom';
}

export function SmtpVerbinden({ formKonfig, setFormKonfig }: Props) {
  const [provider, setProvider] = useState<string>(() => providerAusHost(formKonfig.host || ''));

  const aktuellerPreset = useMemo(
    () => PROVIDER_PRESETS.find((p) => p.schluessel === provider) || PROVIDER_PRESETS[0],
    [provider],
  );

  // Beim Provider-Wechsel: Host/Port automatisch setzen (ausser bei 'custom' —
  // da laesst man stehen, was schon da ist).
  useEffect(() => {
    if (provider === 'custom') return;
    const neu = { ...formKonfig, host: aktuellerPreset.host, port: aktuellerPreset.port };
    // Nur updaten wenn sich wirklich was aendert, sonst Endless-Loop
    if (neu.host !== formKonfig.host || neu.port !== formKonfig.port) {
      setFormKonfig(neu);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const email = formKonfig.absender_email || formKonfig.benutzer || '';
  const passwort = formKonfig.passwort || '';

  const emailAendern = (wert: string) => {
    const name = absenderNameAusEmail(wert);
    setFormKonfig({
      ...formKonfig,
      benutzer: wert,
      absender_email: wert,
      // Absender-Name nur vorbelegen wenn er noch leer ist — nicht ueberschreiben
      absender_name: formKonfig.absender_name || name,
    });
  };

  const passwortAendern = (wert: string) => {
    setFormKonfig({ ...formKonfig, passwort: wert });
  };

  if (provider === 'custom') {
    // Fallback: klassische Feldliste fuer Kunden mit eigenem Server
    const felder = ['host', 'port', 'benutzer', 'passwort', 'absender_name', 'absender_email'];
    return (
      <div className="space-y-2">
        <div className="space-y-0.5">
          <label className="text-xs font-medium ax-text">Anbieter</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg ax-eingabe"
          >
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.schluessel} value={p.schluessel}>{p.label}</option>
            ))}
          </select>
        </div>
        {felder.map((feld) => (
          <div key={feld} className="space-y-0.5">
            <label className="text-xs font-medium ax-text">{feld}</label>
            <input
              type={feld === 'passwort' ? 'password' : 'text'}
              value={formKonfig[feld] || ''}
              onChange={(e) => setFormKonfig({ ...formKonfig, [feld]: e.target.value })}
              className="w-full px-3 py-1.5 text-sm rounded-lg ax-eingabe"
              placeholder={feld}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <label className="text-xs font-medium ax-text">Anbieter</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-lg ax-eingabe"
        >
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.schluessel} value={p.schluessel}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-0.5">
        <label className="text-xs font-medium ax-text">E-Mail-Adresse</label>
        <input
          type="email"
          value={email}
          onChange={(e) => emailAendern(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-lg ax-eingabe"
          placeholder="dein.name@beispiel.de"
          autoComplete="email"
        />
      </div>

      <div className="space-y-0.5">
        <label className="text-xs font-medium ax-text">
          {provider === 'gmail' ? 'App-Passwort' : 'Passwort'}
        </label>
        <input
          type="password"
          value={passwort}
          onChange={(e) => passwortAendern(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-lg ax-eingabe"
          placeholder={provider === 'gmail' ? '16-stelliges App-Passwort' : 'Dein Mail-Passwort'}
          autoComplete="new-password"
        />
      </div>

      {aktuellerPreset.hinweis && (
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-lg p-2.5 leading-relaxed">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
          <div>
            <p>{aktuellerPreset.hinweis}</p>
            {aktuellerPreset.hinweisLink && (
              <a
                href={aktuellerPreset.hinweisLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium hover:opacity-80 mt-1 inline-block"
              >
                {aktuellerPreset.hinweisLink.text} ↗
              </a>
            )}
          </div>
        </div>
      )}

      <details className="text-xs ax-text-tertiaer mt-1">
        <summary className="cursor-pointer hover:ax-text-sekundaer">
          Absender-Name anpassen (optional)
        </summary>
        <input
          type="text"
          value={formKonfig.absender_name || ''}
          onChange={(e) => setFormKonfig({ ...formKonfig, absender_name: e.target.value })}
          className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg ax-eingabe"
          placeholder="Wie soll der Absender heissen?"
        />
      </details>
    </div>
  );
}
