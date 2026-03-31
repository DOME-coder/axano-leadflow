import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { QueryAnbieter } from '@/components/query-anbieter';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Axano LeadFlow',
  description: 'Interne Lead-Management-Plattform der Axano GmbH',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var d = localStorage.getItem('axano-dark-mode');
              if (d === 'true' || (!d && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            })();
          `,
        }} />
      </head>
      <body className={`${manrope.variable} font-sans`}>
        <QueryAnbieter>
          {children}
        </QueryAnbieter>
      </body>
    </html>
  );
}
