'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, Megaphone, Users, TrendingUp } from 'lucide-react';
import { benutzeKunde, benutzeKundeAktualisieren } from '@/hooks/benutze-kunden';

export default function KundeDetailSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kunde, isLoading } = benutzeKunde(id);
  const aktualisieren = benutzeKundeAktualisieren();

  const [bearbeiten, setBearbeiten] = useState(false);
  const [form, setForm] = useState({ name: '', kontaktperson: '', email: '', telefon: '', branche: '', notizen: '' });
  const [erfolg, setErfolg] = useState('');

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
      <div className="ax-karte rounded-xl p-5">
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
    </div>
  );
}
