export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen ax-seite flex items-center justify-center p-4">
      {children}
    </div>
  );
}
