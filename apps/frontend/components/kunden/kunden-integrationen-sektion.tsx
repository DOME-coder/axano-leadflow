'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MessageSquare, RefreshCw, Search, Settings, Trash2 } from 'lucide-react';
import {
  benutzeFacebookDiagnose,
  benutzeFacebookOAuthUrl,
  benutzeGoogleOAuthUrl,
  benutzeKundenIntegrationLoeschen,
  benutzeKundenIntegrationSpeichern,
  benutzeKundenIntegrationen,
  benutzeOutlookOAuthUrl,
  benutzeWhatsappDiagnose,
  benutzeWhatsappOAuthUrl,
  type FacebookDiagnose,
  type WhatsappDiagnose,
} from '@/hooks/benutze-kunden-integrationen';
import { FacebookDiagnoseModal } from '@/components/kampagnen/facebook-diagnose-modal';
import { WhatsappMetaDiagnoseModal } from '@/components/kampagnen/whatsapp-meta-diagnose-modal';
import { SmtpVerbinden } from '@/components/kunden/smtp-verbinden';

export function KundenIntegrationenSektion({ kundeId }: { kundeId: string }) {
  const { data: integrationen, isLoading } = benutzeKundenIntegrationen(kundeId);
  const speichern = benutzeKundenIntegrationSpeichern();
  const loeschen = benutzeKundenIntegrationLoeschen();
  const googleOAuth = benutzeGoogleOAuthUrl(kundeId);
  const outlookOAuth = benutzeOutlookOAuthUrl(kundeId);
  const facebookOAuth = benutzeFacebookOAuthUrl(kundeId);
  const facebookDiagnose = benutzeFacebookDiagnose(kundeId);
  const whatsappOAuth = benutzeWhatsappOAuthUrl(kundeId);
  const whatsappDiagnose = benutzeWhatsappDiagnose(kundeId);

  const [bearbeitenName, setBearbeitenName] = useState<string | null>(null);
  const [formKonfig, setFormKonfig] = useState<Record<string, string>>({});
  const [formAktiv, setFormAktiv] = useState(false);
  const [diagnoseOffen, setDiagnoseOffen] = useState(false);
  const [diagnoseErgebnis, setDiagnoseErgebnis] = useState<FacebookDiagnose | null>(null);
  const [diagnoseFehler, setDiagnoseFehler] = useState<string | null>(null);
  const [whatsappDiagnoseOffen, setWhatsappDiagnoseOffen] = useState(false);
  const [whatsappDiagnoseErgebnis, setWhatsappDiagnoseErgebnis] = useState<WhatsappDiagnose | null>(null);
  const [whatsappDiagnoseFehler, setWhatsappDiagnoseFehler] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bearbeitenName) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setBearbeitenName(null);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [bearbeitenName]);

  const bearbeitenStarten = (integration: { name: string; felder: string[]; konfiguration: Record<string, string>; aktiv: boolean }) => {
    setBearbeitenName(integration.name);
    const konfig: Record<string, string> = {};
    for (const feld of integration.felder) {
      konfig[feld] = integration.konfiguration[feld] || '';
    }
    setFormKonfig(konfig);
    setFormAktiv(integration.aktiv);
  };

  const integrationSpeichern = async (name: string) => {
    await speichern.mutateAsync({ kundeId, name, konfiguration: formKonfig, aktiv: formAktiv });
    setBearbeitenName(null);
  };

  const integrationLoeschen = async (name: string) => {
    await loeschen.mutateAsync({ kundeId, name });
    setBearbeitenName(null);
  };

  const googleVerbinden = async () => {
    const ergebnis = await googleOAuth.mutateAsync();
    window.location.href = ergebnis.url;
  };

  const facebookVerbinden = async () => {
    const ergebnis = await facebookOAuth.mutateAsync();
    window.location.href = ergebnis.url;
  };

  const facebookDiagnoseStarten = async () => {
    setDiagnoseOffen(true);
    setDiagnoseErgebnis(null);
    setDiagnoseFehler(null);
    try {
      const ergebnis = await facebookDiagnose.mutateAsync();
      setDiagnoseErgebnis(ergebnis);
    } catch (fehler: unknown) {
      const f = fehler as { response?: { data?: { fehler?: string; message?: string } } };
      setDiagnoseFehler(
        f?.response?.data?.fehler ||
        f?.response?.data?.message ||
        'Unbekannter Fehler bei der Diagnose'
      );
    }
  };

  const whatsappVerbinden = async () => {
    const ergebnis = await whatsappOAuth.mutateAsync();
    window.location.href = ergebnis.url;
  };

  const whatsappDiagnoseStarten = async () => {
    setWhatsappDiagnoseOffen(true);
    setWhatsappDiagnoseErgebnis(null);
    setWhatsappDiagnoseFehler(null);
    try {
      const ergebnis = await whatsappDiagnose.mutateAsync();
      setWhatsappDiagnoseErgebnis(ergebnis);
    } catch (fehler: unknown) {
      const f = fehler as { response?: { data?: { fehler?: string; message?: string } } };
      setWhatsappDiagnoseFehler(
        f?.response?.data?.fehler ||
        f?.response?.data?.message ||
        'Unbekannter Fehler bei der Diagnose'
      );
    }
  };

  const outlookVerbinden = async () => {
    const ergebnis = await outlookOAuth.mutateAsync();
    window.location.href = ergebnis.url;
  };

  if (isLoading) return null;

  const wichtigeIntegrationen =
    integrationen?.filter((i) =>
      ['vapi', 'smtp', 'superchat', 'whatsapp', 'facebook', 'google', 'outlook', 'calendly'].includes(i.name),
    ) || [];

  return (
    <div className="ax-karte rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-4 h-4 ax-text-tertiaer" />
        <h3 className="font-semibold ax-titel text-sm">Kunden-Integrationen</h3>
      </div>
      <p className="text-xs ax-text-sekundaer mb-4">
        Anrufe, E-Mails, WhatsApp und Kalender für diesen Kunden. Alles läuft im Namen des Kunden – nie im Namen von Axano.
      </p>

      <div className="space-y-3">
        {wichtigeIntegrationen.map((integration) => (
          <div key={integration.name} className="border ax-rahmen-leicht rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium ax-titel">{integration.typ}</span>
                {integration.eigeneKonfiguration ? (
                  <span className="text-xs bg-axano-orange/10 text-axano-orange px-2 py-0.5 rounded-full font-medium">
                    Eigene Konfiguration
                  </span>
                ) : (
                  <span className="text-xs ax-karte-erhoeht ax-text-tertiaer px-2 py-0.5 rounded-full">
                    Global
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {integration.name === 'google' && !integration.eigeneKonfiguration && (
                  <button
                    onClick={googleVerbinden}
                    disabled={googleOAuth.isPending}
                    className="flex items-center gap-1 text-xs bg-axano-orange hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {googleOAuth.isPending ? 'Verbinde...' : 'Mit Google verbinden'}
                  </button>
                )}
                {integration.name === 'outlook' && !integration.eigeneKonfiguration && (
                  <button
                    onClick={outlookVerbinden}
                    disabled={outlookOAuth.isPending}
                    className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {outlookOAuth.isPending ? 'Verbinde...' : 'Mit Outlook verbinden'}
                  </button>
                )}
                {integration.name === 'facebook' && !integration.eigeneKonfiguration && (
                  <button
                    onClick={facebookVerbinden}
                    disabled={facebookOAuth.isPending}
                    className="flex items-center gap-1 text-xs bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {facebookOAuth.isPending ? 'Verbinde...' : 'Mit Facebook verbinden'}
                  </button>
                )}
                {integration.name === 'facebook' && integration.eigeneKonfiguration && (
                  <button
                    onClick={facebookDiagnoseStarten}
                    disabled={facebookDiagnose.isPending}
                    title="Prueft Seite, Berechtigungen und Formulare live bei Facebook"
                    className="flex items-center gap-1 text-xs bg-axano-primaer hover:opacity-90 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <Search className="w-3 h-3" strokeWidth={2.2} />
                    {facebookDiagnose.isPending ? 'Prueft...' : 'Verbindung testen'}
                  </button>
                )}
                {integration.name === 'whatsapp' && !integration.eigeneKonfiguration && (
                  <button
                    onClick={whatsappVerbinden}
                    disabled={whatsappOAuth.isPending}
                    className="flex items-center gap-1 text-xs bg-[#25D366] hover:bg-[#1da851] text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <MessageSquare className="w-3 h-3" strokeWidth={2.2} />
                    {whatsappOAuth.isPending ? 'Verbinde...' : 'Mit WhatsApp verbinden'}
                  </button>
                )}
                {integration.name === 'whatsapp' && integration.eigeneKonfiguration && (
                  <button
                    onClick={whatsappDiagnoseStarten}
                    disabled={whatsappDiagnose.isPending}
                    title="Prueft Business Account, Telefonnummern und Templates live bei Meta"
                    className="flex items-center gap-1 text-xs bg-axano-primaer hover:opacity-90 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <Search className="w-3 h-3" strokeWidth={2.2} />
                    {whatsappDiagnose.isPending ? 'Prueft...' : 'Verbindung testen'}
                  </button>
                )}
                {integration.name === 'superchat' && !integration.eigeneKonfiguration && (
                  <button
                    onClick={() => bearbeitenStarten(integration)}
                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Mit Superchat verbinden
                  </button>
                )}
                {bearbeitenName !== integration.name && (
                  <button
                    onClick={() => bearbeitenStarten(integration)}
                    className="text-xs ax-text-sekundaer ax-hover px-2 py-1 rounded transition-all"
                  >
                    Konfigurieren
                  </button>
                )}
              </div>
            </div>

            {bearbeitenName === integration.name && (
              <div ref={formRef} className="mt-3 space-y-2 pt-3 border-t ax-rahmen-leicht">
                {integration.name === 'superchat' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-lg p-3 mb-2 leading-relaxed">
                    <strong>Superchat API-Schlüssel besorgen:</strong> Melde dich im Superchat-Dashboard an, gehe zu{' '}
                    <em>Einstellungen → API</em> und erstelle einen API-Schlüssel. Die Basis-URL ist standardmäßig{' '}
                    <code className="ax-karte-erhoeht px-1 rounded">https://api.superchat.de</code>. Das Webhook-Geheimnis findest du
                    im Bereich <em>Webhooks</em> (optional, für Signatur-Prüfung eingehender Nachrichten).
                  </div>
                )}
                {integration.name === 'smtp' ? (
                  <SmtpVerbinden formKonfig={formKonfig} setFormKonfig={setFormKonfig} />
                ) : (
                  integration.felder.map((feld) => (
                    <div key={feld} className="space-y-0.5">
                      <label className="text-xs font-medium ax-text">{feld}</label>
                      <input
                        type={
                          feld.includes('geheimnis') || feld.includes('schluessel') || feld.includes('token') || feld.includes('passwort')
                            ? 'password'
                            : 'text'
                        }
                        value={formKonfig[feld] || ''}
                        onChange={(e) => setFormKonfig({ ...formKonfig, [feld]: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm rounded-lg ax-eingabe"
                        placeholder={feld}
                      />
                    </div>
                  ))
                )}
                <div className="flex items-center gap-2 pt-2">
                  <label className="flex items-center gap-1.5 text-xs ax-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAktiv}
                      onChange={(e) => setFormAktiv(e.target.checked)}
                      className="rounded"
                    />
                    Aktiv
                  </label>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => integrationSpeichern(integration.name)}
                    disabled={speichern.isPending}
                    className="bg-axano-orange hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                  >
                    Speichern
                  </button>
                  {integration.eigeneKonfiguration && (
                    <button
                      onClick={() => integrationLoeschen(integration.name)}
                      disabled={loeschen.isPending}
                      className="flex items-center gap-1 text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <RefreshCw className="w-3 h-3" />
                      Auf global zurücksetzen
                    </button>
                  )}
                  <button
                    onClick={() => setBearbeitenName(null)}
                    className="ax-text-sekundaer px-2 py-1.5 rounded-lg text-xs ax-hover"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {diagnoseOffen && (
        <FacebookDiagnoseModal
          diagnose={diagnoseErgebnis}
          laedt={facebookDiagnose.isPending}
          fehler={diagnoseFehler}
          onSchliessen={() => {
            setDiagnoseOffen(false);
            setDiagnoseErgebnis(null);
            setDiagnoseFehler(null);
          }}
        />
      )}

      {whatsappDiagnoseOffen && (
        <WhatsappMetaDiagnoseModal
          diagnose={whatsappDiagnoseErgebnis}
          laedt={whatsappDiagnose.isPending}
          fehler={whatsappDiagnoseFehler}
          onSchliessen={() => {
            setWhatsappDiagnoseOffen(false);
            setWhatsappDiagnoseErgebnis(null);
            setWhatsappDiagnoseFehler(null);
          }}
        />
      )}
    </div>
  );
}
