import crypto from 'crypto';

/**
 * Verifiziert die HMAC-SHA256-Signatur eines Webhook-Payloads.
 */
export function webhookSignaturVerifizieren(
  nutzlast: string,
  signatur: string,
  geheimnis: string
): boolean {
  const erwarteteSignatur = crypto
    .createHmac('sha256', geheimnis)
    .update(nutzlast, 'utf8')
    .digest('hex');

  const signaturWert = signatur.startsWith('sha256=')
    ? signatur.substring(7)
    : signatur;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signaturWert, 'hex'),
      Buffer.from(erwarteteSignatur, 'hex')
    );
  } catch {
    return false;
  }
}
