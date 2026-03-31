import { Calendar } from 'lucide-react';

export default function KalenderSeite() {
  return (
    <div className="animate-einblenden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">Kalender</h1>
        <p className="text-sm ax-text-sekundaer mt-1">
          Termine und Terminplanung
        </p>
      </div>
      <div className="ax-karte rounded-xl p-12 text-center">
        <Calendar className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
        <h3 className="text-lg font-semibold ax-titel mb-1">
          Kalender wird eingerichtet
        </h3>
        <p className="text-sm ax-text-sekundaer">
          Calendly- und Google Calendar-Integration werden in Phase 4 implementiert.
        </p>
      </div>
    </div>
  );
}
