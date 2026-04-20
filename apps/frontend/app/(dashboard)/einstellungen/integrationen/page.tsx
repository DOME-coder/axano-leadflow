'use client';

import { useState } from 'react';
import { Plug, Check, X, Loader2, TestTube, Save } from 'lucide-react';
import {
  benutzeIntegrationen,
  benutzeIntegrationSpeichern,
  benutzeIntegrationTesten,
} from '@/hooks/benutze-integrationen';

const integrationIcons: Record<string, string> = {
  smtp: '📧',
  facebook: '📘',
  superchat: '💬',
  google: '📅',
  calendly: '🗓️',
  outlook: '📬',
  vapi: '📞',
  anthropic: '🧠',
};

const feldBezeichnungen: Record<string, string> = {
  host: 'SMTP Host',
  port: 'Port',
  benutzer: 'Benutzername',
  passwort: 'Passwort',
  absender_name: 'Absendername',
  absender_email: 'Absender-E-Mail',
  app_id: 'App ID',
  app_geheimnis: 'App Secret',
  verify_token: 'Verify Token',
  seiten_zugriffstoken: 'Seiten-Zugriffstoken',
  api_schluessel: 'API-Schlüssel',
  webhook_geheimnis: 'Webhook Secret',
  basis_url: 'Basis-URL',
  client_id: 'Client ID',
  client_geheimnis: 'Client Secret',
  refresh_token: 'Refresh Token',
  webhook_signing_key: 'Webhook Signing Key',
  tenant_id: 'Tenant ID',
  modell: 'Claude-Modell (z.B. claude-sonnet-4-20250514)',
};

export default function IntegrationenSeite() {
  const { data: integrationen, isLoading } = benutzeIntegrationen();
  const speichern = benutzeIntegrationSpeichern();
  const testen = benutzeIntegrationTesten();

  const [bearbeitete, setBearbeitete] = useState<string | null>(null);
  const [formDaten, setFormDaten] = useState<Record<string, string>>({});
  const [aktiv, setAktiv] = useState(false);
  const [testErgebnis, setTestErgebnis] = useState<{ erfolg: boolean; nachricht: string } | null>(null);

  const bearbeitenStarten = (integration: { name: string; konfiguration: Record<string, string>; aktiv: boolean }) => {
    setBearbeitete(integration.name);
    setFormDaten({ ...integration.konfiguration });
    setAktiv(integration.aktiv);
    setTestErgebnis(null);
  };

  const bearbeitenAbbrechen = () => {
    setBearbeitete(null);
    setFormDaten({});
    setTestErgebnis(null);
  };

  const integrationSpeichern = async () => {
    if (!bearbeitete) return;
    await speichern.mutateAsync({ name: bearbeitete, konfiguration: formDaten, aktiv });
    setBearbeitete(null);
    setTestErgebnis(null);
  };

  const verbindungTesten = async () => {
    if (!bearbeitete) return;
    setTestErgebnis(null);
    try {
      const ergebnis = await testen.mutateAsync({ name: bearbeitete, konfiguration: formDaten });
      setTestErgebnis(ergebnis);
    } catch {
      setTestErgebnis({ erfolg: false, nachricht: 'Verbindungstest fehlgeschlagen' });
    }
  };

  if (isLoading) {
    return (
      <div className="animate-einblenden">
        <h1 className="text-2xl font-bold ax-titel mb-6">Integrationen</h1>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-einblenden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">KI-Konfiguration</h1>
        <p className="text-sm ax-text-sekundaer mt-1">
          API-Keys für die interne KI-Verarbeitung (Prompt-Generierung und Transkript-Analyse).
          Alle anderen Integrationen (VAPI, E-Mail, WhatsApp, Kalender) werden pro Kunde konfiguriert.
        </p>
      </div>

      <div className="space-y-3">
        {integrationen?.filter((i) => ['anthropic'].includes(i.name)).map((integration) => (
          <div
            key={integration.name}
            className="ax-karte rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div
              className="p-5 flex items-center justify-between cursor-pointer ax-hover transition-all"
              onClick={() => bearbeitete === integration.name ? bearbeitenAbbrechen() : bearbeitenStarten(integration)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{integrationIcons[integration.name] || '🔌'}</span>
                <div>
                  <h3 className="font-semibold ax-titel text-sm">{integration.typ}</h3>
                  <p className="text-xs ax-text-sekundaer">{integration.name}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                integration.aktiv
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {integration.aktiv ? 'Verbunden' : 'Nicht konfiguriert'}
              </span>
            </div>

            {/* Bearbeitungsformular */}
            {bearbeitete === integration.name && (
              <div className="border-t ax-rahmen-leicht p-5 ax-karte-erhoeht">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {integration.felder.map((feld) => (
                    <div key={feld} className="space-y-1">
                      <label className="text-xs font-medium ax-text">
                        {feldBezeichnungen[feld] || feld}
                      </label>
                      <input
                        type={feld.includes('passwort') || feld.includes('geheimnis') || feld.includes('schluessel') || feld.includes('token') ? 'password' : 'text'}
                        value={formDaten[feld] || ''}
                        onChange={(e) => setFormDaten({ ...formDaten, [feld]: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                        placeholder={feldBezeichnungen[feld] || feld}
                      />
                    </div>
                  ))}
                </div>

                {/* Aktiv-Toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setAktiv(!aktiv)}
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      aktiv ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      aktiv ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                  <span className="text-sm ax-text">{aktiv ? 'Aktiv' : 'Inaktiv'}</span>
                </div>

                {/* Test-Ergebnis */}
                {testErgebnis && (
                  <div className={`text-sm rounded-lg p-3 mb-4 flex items-center gap-2 ${
                    testErgebnis.erfolg
                      ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                      : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  }`}>
                    {testErgebnis.erfolg ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {testErgebnis.nachricht}
                  </div>
                )}

                {/* Aktionen */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={verbindungTesten}
                    disabled={testen.isPending}
                    className="flex items-center gap-1.5 border ax-rahmen-leicht ax-text font-medium px-4 py-2 rounded-lg transition-all text-sm ax-hover disabled:opacity-50"
                  >
                    {testen.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                    Testen
                  </button>
                  <button
                    onClick={bearbeitenAbbrechen}
                    className="border ax-rahmen-leicht ax-text font-medium px-4 py-2 rounded-lg transition-all text-sm ax-hover"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={integrationSpeichern}
                    disabled={speichern.isPending}
                    className="flex items-center gap-1.5 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg transition-all text-sm disabled:opacity-50"
                  >
                    {speichern.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
