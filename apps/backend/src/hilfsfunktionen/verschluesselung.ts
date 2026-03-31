import crypto from 'crypto';

const ALGORITHMUS = 'aes-256-gcm';

function schluesselLaden(): Buffer {
  const schluessel = process.env.VERSCHLUESSELUNGS_SCHLUESSEL;
  if (!schluessel) {
    throw new Error('VERSCHLUESSELUNGS_SCHLUESSEL ist nicht konfiguriert');
  }
  // Schlüssel auf 32 Bytes bringen (SHA-256 Hash)
  return crypto.createHash('sha256').update(schluessel).digest();
}

/**
 * Verschlüsselt einen Text mit AES-256-GCM.
 * Rückgabe: "iv:authTag:verschlüsselterText" (hex-kodiert)
 */
export function verschluesseln(text: string): string {
  const schluessel = schluesselLaden();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHMUS, schluessel, iv);

  const verschluesselt = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${verschluesselt.toString('hex')}`;
}

/**
 * Entschlüsselt einen mit verschluesseln() verschlüsselten Text.
 */
export function entschluesseln(verschluesseltText: string): string {
  const schluessel = schluesselLaden();
  const [ivHex, authTagHex, datenHex] = verschluesseltText.split(':');

  if (!ivHex || !authTagHex || !datenHex) {
    throw new Error('Ungültiges verschlüsseltes Format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const verschluesselt = Buffer.from(datenHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHMUS, schluessel, iv);
  decipher.setAuthTag(authTag);

  const entschluesselt = Buffer.concat([
    decipher.update(verschluesselt),
    decipher.final(),
  ]);

  return entschluesselt.toString('utf8');
}

/**
 * Verschlüsselt alle Werte in einem Konfigurationsobjekt.
 */
export function konfigurationVerschluesseln(konfig: Record<string, string>): Record<string, string> {
  const ergebnis: Record<string, string> = {};
  for (const [schluessel, wert] of Object.entries(konfig)) {
    ergebnis[schluessel] = wert ? verschluesseln(wert) : '';
  }
  return ergebnis;
}

/**
 * Entschlüsselt alle Werte in einem Konfigurationsobjekt.
 */
export function konfigurationEntschluesseln(konfig: Record<string, string>): Record<string, string> {
  const ergebnis: Record<string, string> = {};
  for (const [schluessel, wert] of Object.entries(konfig)) {
    try {
      ergebnis[schluessel] = wert ? entschluesseln(wert) : '';
    } catch {
      ergebnis[schluessel] = wert; // Falls nicht verschlüsselt, Originalwert zurückgeben
    }
  }
  return ergebnis;
}
