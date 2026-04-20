import { Seitenleiste } from '@/components/layout/seitenleiste';
import { Kopfzeile } from '@/components/layout/kopfzeile';
import { ToastContainer } from '@/components/ui/toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen ax-seite">
      <Seitenleiste />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Dezentes Hintergrund-Pattern – nur im Main-Bereich */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #1a2b4c 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />
        <Kopfzeile />
        <main className="flex-1 px-7 pt-7 pb-10 overflow-auto relative">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
