'use client';

/**
 * Root-Level Error-Boundary — faengt Fehler ab, die im root layout selbst passieren.
 * Muss <html>/<body> selbst rendern, weil das Layout ja crashed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f5f7fa',
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          border: '1px solid #d5e1ed',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#1a2b4c', margin: '0 0 12px' }}>
            Anwendungsfehler
          </h1>
          <p style={{ color: '#6b7d94', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
            Die Anwendung konnte nicht geladen werden. Bitte versuche es erneut.
          </p>
          {error.digest && (
            <p style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace', marginBottom: '16px' }}>
              Fehler-ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              background: '#ff8049',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
