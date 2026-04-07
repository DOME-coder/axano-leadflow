'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Building2, Search, ArrowUpRight } from 'lucide-react';
import { benutzeKunden, benutzeKundeErstellen } from '@/hooks/benutze-kunden';
import { useToastStore } from '@/stores/toast-store';

export default function KundenSeite() {
  const [suche, setSuche] = useState('');
  const { data, isLoading } = benutzeKunden({ suche: suche || undefined });
  const kundeErstellen = benutzeKundeErstellen();
  const { toastAnzeigen } = useToastStore();

  const [neuerKunde, setNeuerKunde] = useState(false);
  const [name, setName] = useState('');
  const [kontaktperson, setKontaktperson] = useState('');
  const [email, setEmail] = useState('');
  const [branche, setBranche] = useState('');

  const handleErstellen = async () => {
    if (!name.trim()) return;
    await kundeErstellen.mutateAsync({
      name: name.trim(),
      kontaktperson: kontaktperson.trim() || undefined,
      email: email.trim() || undefined,
      branche: branche.trim() || undefined,
    });
    toastAnzeigen('erfolg', 'Kunde erstellt');
    setNeuerKunde(false);
    setName('');
    setKontaktperson('');
    setEmail('');
    setBranche('');
  };

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">Kunden</h1>
          <p className="text-sm ax-text-sekundaer mt-1">Verwalten Sie Ihre Kundenstammdaten</p>
        </div>
        <button
          onClick={() => setNeuerKunde(true)}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Neuer Kunde
        </button>
      </div>

      {/* Suche */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ax-text-tertiaer" />
        <input
          type="text"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg ax-eingabe"
          placeholder="Kunden suchen..."
        />
      </div>

      {/* Neuer Kunde Modal */}
      {neuerKunde && (
        <div className="ax-karte rounded-xl p-5 mb-4 border-2 border-axano-orange/30">
          <h3 className="font-semibold ax-titel text-sm mb-3">Neuen Kunden anlegen</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" placeholder="Firmenname" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Kontaktperson</label>
              <input value={kontaktperson} onChange={(e) => setKontaktperson(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" placeholder="Max Mustermann" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">E-Mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" placeholder="info@firma.de" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Branche</label>
              <input value={branche} onChange={(e) => setBranche(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" placeholder="z.B. Versicherung" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleErstellen} disabled={!name.trim() || kundeErstellen.isPending}
              className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {kundeErstellen.isPending ? 'Wird erstellt...' : 'Kunde erstellen'}
            </button>
            <button onClick={() => setNeuerKunde(false)}
              className="border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg text-sm ax-hover">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Kundenliste */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ax-karte rounded-xl p-5 h-40">
              <div className="skeleton h-5 w-2/3 rounded mb-3" />
              <div className="skeleton h-4 w-1/2 rounded mb-6" />
              <div className="skeleton h-8 w-full rounded" />
            </div>
          ))}
        </div>
      ) : data?.eintraege.length === 0 ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <Building2 className="w-12 h-12 ax-text-tertiaer mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">Noch keine Kunden</h3>
          <p className="text-sm ax-text-sekundaer mb-4">Legen Sie Ihren ersten Kunden an.</p>
          <button onClick={() => setNeuerKunde(true)}
            className="inline-flex items-center gap-2 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm">
            <Plus className="w-4 h-4" /> Ersten Kunden anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.eintraege.map((kunde) => (
            <Link key={kunde.id} href={`/kunden/${kunde.id}`}
              className="ax-karte rounded-xl p-5 hover:shadow-sm hover:border-axano-orange/30 transition-all group block">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold ax-titel text-sm truncate group-hover:text-axano-orange transition-colors">
                    {kunde.name}
                  </h3>
                  {kunde.kontaktperson && (
                    <p className="text-xs ax-text-sekundaer mt-0.5">{kunde.kontaktperson}</p>
                  )}
                </div>
                <ArrowUpRight className="w-4 h-4 ax-text-tertiaer group-hover:text-axano-orange transition-colors flex-shrink-0 ml-2" />
              </div>

              {kunde.branche && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {kunde.branche}
                </span>
              )}

              {kunde.statistiken && (
                <div className="grid grid-cols-3 gap-3 pt-3 mt-3 border-t ax-rahmen-leicht">
                  <div>
                    <p className="text-xs ax-text-tertiaer">Kampagnen</p>
                    <p className="text-lg font-bold ax-titel">{kunde.statistiken.kampagnenAnzahl}</p>
                  </div>
                  <div>
                    <p className="text-xs ax-text-tertiaer">Leads</p>
                    <p className="text-lg font-bold ax-titel">{kunde.statistiken.gesamtLeads}</p>
                  </div>
                  <div>
                    <p className="text-xs ax-text-tertiaer">Conversion</p>
                    <p className="text-lg font-bold text-axano-orange">{kunde.statistiken.conversionRate}%</p>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
