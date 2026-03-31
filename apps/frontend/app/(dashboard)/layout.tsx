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
      <div className="flex-1 flex flex-col">
        <Kopfzeile />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
