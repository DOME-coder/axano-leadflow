import { logger } from '../hilfsfunktionen/logger';

interface ImapKonfiguration {
  imap_host: string;
  imap_port: number;
  imap_benutzer: string;
  imap_passwort: string;
  imap_ordner?: string;
}

interface EingehendeEmail {
  absenderName: string;
  absenderEmail: string;
  betreff: string;
  textInhalt: string;
  datum: Date;
}

/**
 * Ruft neue (ungelesene) E-Mails per IMAP ab.
 * Verwendet dynamisches import für imapflow (optional dependency).
 */
export async function neueEmailsAbrufen(konfig: ImapKonfiguration): Promise<EingehendeEmail[]> {
  let ImapFlow;
  try {
    const modul = await import('imapflow');
    ImapFlow = modul.ImapFlow;
  } catch {
    logger.warn('imapflow ist nicht installiert – IMAP-Polling übersprungen');
    return [];
  }

  const client = new ImapFlow({
    host: konfig.imap_host,
    port: konfig.imap_port,
    secure: konfig.imap_port === 993,
    auth: {
      user: konfig.imap_benutzer,
      pass: konfig.imap_passwort,
    },
    logger: false,
  });

  const emails: EingehendeEmail[] = [];

  try {
    await client.connect();
    const ordner = konfig.imap_ordner || 'INBOX';
    const lock = await client.getMailboxLock(ordner);

    try {
      // Ungelesene E-Mails suchen
      const nachrichten = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
      });

      for await (const nachricht of nachrichten) {
        const absender = nachricht.envelope?.from?.[0] as { name?: string; address?: string } | undefined;
        if (!absender) continue;

        const absenderName = absender.name || absender.address || 'Unbekannt';
        const absenderEmail = absender.address || '';

        // Text-Inhalt extrahieren
        let textInhalt = '';
        if (nachricht.source) {
          const quelltext = nachricht.source.toString();
          // Einfache Text-Extraktion aus dem Rohtext
          const textMatch = quelltext.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i);
          textInhalt = textMatch?.[1]?.trim() || '';
        }

        emails.push({
          absenderName,
          absenderEmail,
          betreff: nachricht.envelope?.subject || '(Kein Betreff)',
          textInhalt,
          datum: nachricht.envelope?.date || new Date(),
        });

        // Als gelesen markieren
        await client.messageFlagsAdd(nachricht.seq, ['\\Seen'], { uid: false });
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (fehler) {
    logger.error('IMAP-Abruf fehlgeschlagen:', {
      host: konfig.imap_host,
      error: fehler instanceof Error ? fehler.message : fehler,
    });
    try { await client.logout(); } catch { /* ignorieren */ }
  }

  return emails;
}

/**
 * Extrahiert Vor- und Nachname aus einem E-Mail-Absendernamen.
 */
export function absenderNameAufteilen(name: string): { vorname: string; nachname?: string } {
  const bereinigt = name.replace(/['"<>]/g, '').trim();
  const teile = bereinigt.split(/\s+/);

  if (teile.length === 0) return { vorname: 'Unbekannt' };
  if (teile.length === 1) return { vorname: teile[0] };

  return {
    vorname: teile[0],
    nachname: teile.slice(1).join(' '),
  };
}
