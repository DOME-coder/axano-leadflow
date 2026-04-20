'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, Megaphone, Users, TrendingUp, Settings, ExternalLink, Trash2, RefreshCw, Search } from 'lucide-react';
import { benutzeKunde, benutzeKundeAktualisieren } from '@/hooks/benutze-kunden';
import { benutzeKundenIntegrationen, benutzeKundenIntegrationSpeichern, benutzeKundenIntegrationLoeschen, benutzeGoogleOAuthUrl, benutzeOutlookOAuthUrl, benutzeFacebookOAuthUrl, benutzeFacebookDiagnose, type FacebookDiagnose } from '@/hooks/benutze-kunden-integrationen';
import { FacebookDiagnoseModal } from '@/components/kampagnen/facebook-diagnose-modal';
import { useToastStore } from '@/stores/toast-store';

export default function KundeDetailSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kunde, isLoading } = benutzeKunde(id);
  const aktualisieren = benutzeKundeAktualisieren();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toastAnzeigen } = useToastStore();

  const [bearbeiten, setBearbeiten] = useState(false);
  const [form, setForm] = useState({ name: '', kontaktperson: '', email: '', telefon: '', branche: '', notizen: '' });
  const [erfolg, setErfolg] = useState('');

  // OAuth-Callback-Feedback: nach Redirect von Google/Outlook/Facebook
  useEffect(() => {
    if (!searchParams) return;
    const google = searchParams.get('google_calendar');
    const outlook = searchParams.get('outlook_calendar');
    const facebook = searchParams.get('facebook_lead_ads');
    const grund = searchParams.get('grund');

    if (google === 'verbunden') {
      toastAnzeigen('erfolg', 'Google Calendar erfolgreich verbunden');
    } else if (google === 'fehler') {
      toastAnzeigen('fehler', `Google Calendar konnte nicht verbunden werden${grund ? `: ${grund}` : ''}`);
    } else if (outlook === 'verbunden') {
      toastAnzeigen('erfolg', 'Outlook Calendar erfolgreich verbunden');
    } else if (outlook === 'fehler') {
      toastAnzeigen('fehler', `Outlook Calendar konnte nicht verbunden werden${grund ? `: ${grund}` : ''}`);
    } else if (facebook === 'verbunden') {
      toastAnzeigen('erfolg', 'Facebook Lead Ads erfolgreich verbunden');
    } else if (facebook === 'fehler') {
      toastAnzeigen('fehler', `Facebook konnte nicht verbunden werden${grund ? `: ${grund}` : ''}`);
    }

    // Query-Params nach dem Anzeigen aufräumen
    if (google || outlook || facebook) {
      router.replace(`/kunden/${id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const bearbeitenStarten = () => {
    if (kunde) {
      setForm({
        name: kunde.name || '',
        kontaktperson: kunde.kontaktperson || '',
        email: kunde.email || '',
        telefon: kunde.telefon || '',
        branche: kunde.branche || '',
        notizen: kunde.notizen || '',
      });
      setBearbeiten(true);
    }
  };

  const speichern = async () => {
    await aktualisieren.mutateAsync({ id, ...form });
    setBearbeiten(false);
    setErfolg('Kunde gespeichert');
    setTimeout(() => setErfolg(''), 3000);
  };

  if (isLoading) {
    return (
      <div className="animate-einblenden max-w-3xl">
        <div className="skeleton h-8 w-64 rounded mb-4" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!kunde) return null;

  return (
    <div className="animate-einblenden max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/kunden" className="p-1.5 rounded-lg ax-text-tertiaer ax-hover transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold ax-titel">{kunde.name}</h1>
            {kunde.kontaktperson && <p className="text-xs ax-text-sekundaer">{kunde.kontaktperson}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!bearbeiten && (
            <button onClick={bearbeitenStarten}
              className="border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg text-sm ax-hover font-medium">
              Bearbeiten
            </button>
          )}
          <Link href={`/kampagnen/neu?kundeId=${id}`}
            className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Neue Kampagne
          </Link>
        </div>
      </div>

      {erfolg && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-lg p-3 mb-4">
          {erfolg}
        </div>
      )}

      {/* Statistiken */}
      {kunde.statistiken && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="ax-karte rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 ax-text-tertiaer" />
              <p className="text-xs ax-text-sekundaer">Kampagnen</p>
            </div>
            <p className="text-2xl font-bold ax-titel">{kunde.statistiken.kampagnenAnzahl}</p>
          </div>
          <div className="ax-karte rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 ax-text-tertiaer" />
              <p className="text-xs ax-text-sekundaer">Gesamt-Leads</p>
            </div>
            <p className="text-2xl font-bold ax-titel">{kunde.statistiken.gesamtLeads}</p>
          </div>
          <div className="ax-karte rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 ax-text-tertiaer" />
              <p className="text-xs ax-text-sekundaer">Conversion</p>
            </div>
            <p className="text-2xl font-bold text-axano-orange">{kunde.statistiken.conversionRate}%</p>
          </div>
        </div>
      )}

      {/* Kundendaten */}
      <div className="ax-karte rounded-xl p-5 mb-4">
        <h3 className="font-semibold ax-titel text-sm mb-3">Kundendaten</h3>
        {bearbeiten ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Kontaktperson</label>
                <input value={form.kontaktperson} onChange={(e) => setForm({ ...form, kontaktperson: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">E-Mail</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Telefon</label>
                <input value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Branche</label>
                <input value={form.branche} onChange={(e) => setForm({ ...form, branche: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Notizen</label>
              <textarea value={form.notizen} onChange={(e) => setForm({ ...form, notizen: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe resize-none" rows={3} />
            </div>
            <div className="flex gap-2">
              <button onClick={speichern} disabled={aktualisieren.isPending}
                className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> Speichern
              </button>
              <button onClick={() => setBearbeiten(false)}
                className="border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg text-sm ax-hover">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="ax-text-sekundaer">E-Mail:</span> <span className="ax-titel ml-1">{kunde.email || '—'}</span></div>
            <div><span className="ax-text-sekundaer">Telefon:</span> <span className="ax-titel ml-1">{kunde.telefon || '—'}</span></div>
            <div><span className="ax-text-sekundaer">Branche:</span> <span className="ax-titel ml-1">{kunde.branche || '—'}</span></div>
            <div><span className="ax-text-sekundaer">Kontakt:</span> <span className="ax-titel ml-1">{kunde.kontaktperson || '—'}</span></div>
            {kunde.notizen && (
              <div className="col-span-2"><span className="ax-text-sekundaer">Notizen:</span> <span className="ax-titel ml-1">{kunde.notizen}</span></div>
            )}
          </div>
        )}
      </div>

      {/* Kampagnen des Kunden */}
      <div className="ax-karte rounded-xl p-5 mb-4">
        <h3 className="font-semibold ax-titel text-sm mb-3">Kampagnen ({kunde.kampagnen?.length || 0})</h3>
        {kunde.kampagnen?.length ? (
          <div className="space-y-2">
            {kunde.kampagnen.map((k) => (
              <Link key={k.id} href={`/kampagnen/${k.id}/leads`}
                className="flex items-center justify-between p-3 rounded-lg ax-hover transition-all group">
                <div>
                  <p className="text-sm font-medium ax-titel group-hover:text-axano-orange transition-colors">{k.name}</p>
                  <p className="text-xs ax-text-tertiaer">{k._count.leads} Leads</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  k.status === 'aktiv' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : k.status === 'pausiert' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>{k.status === 'aktiv' ? 'Aktiv' : k.status === 'pausiert' ? 'Pausiert' : 'Archiviert'}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm ax-text-tertiaer">Noch keine Kampagnen für diesen Kunden.</p>
        )}
      </div>

      {/* Kunden-Integrationen */}
      <KundenIntegrationenSektion kundeId={id} />
    </div>
  );
}

function KundenIntegrationenSektion({ kundeId }: { kundeId: string }) {
  const { data: integrationen, isLoading } = benutzeKundenIntegrationen(kundeId);
  const speichern = benutzeKundenIntegrationSpeichern();
  const loeschen = benutzeKundenIntegrationLoeschen();
  const googleOAuth = benutzeGoogleOAuthUrl(kundeId);
  const outlookOAuth = benutzeOutlookOAuthUrl(kundeId);
  const facebookOAuth = benutzeFacebookOAuthUrl(kundeId);
  const facebookDiagnose = benutzeFacebookDiagnose(kundeId);

  const [bearbeitenName, setBearbeitenName] = useState<string | null>(null);
  const [formKonfig, setFormKonfig] = useState<Record<string, string>>({});
  const [formAktiv, setFormAktiv] = useState(false);
  const [diagnoseOffen, setDiagnoseOffen] = useState(false);
  const [diagnoseErgebnis, setDiagnoseErgebnis] = useState<FacebookDiagnose | null>(null);
  const [diagnoseFehler, setDiagnoseFehler] = useState<string | null>(null);

  // Klick ausserhalb des Formulars schliesst es
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bearbeitenName) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setBearbeitenName(null);
      }
    };
    // Delay damit der Klick auf "Konfigurieren" nicht sofort wieder schliesst
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); };
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

  const outlookVerbinden = async () => {
    const ergebnis = await outlookOAuth.mutateAsync();
    window.location.href = ergebnis.url;
  };

  if (isLoading) return null;

  const wichtigeIntegrationen = integrationen?.filter((i) =>
    ['vapi', 'smtp', 'superchat', 'facebook', 'google', 'outlook', 'calendly'].includes(i.name)
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
                {integration.felder.map((feld) => (
                  <div key={feld} className="space-y-0.5">
                    <label className="text-xs font-medium ax-text">{feld}</label>
                    <input
                      type={feld.includes('geheimnis') || feld.includes('schluessel') || feld.includes('token') || feld.includes('passwort') ? 'password' : 'text'}
                      value={formKonfig[feld] || ''}
                      onChange={(e) => setFormKonfig({ ...formKonfig, [feld]: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm rounded-lg ax-eingabe"
                      placeholder={feld}
                    />
                  </div>
                ))}
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
    </div>
  );
}
