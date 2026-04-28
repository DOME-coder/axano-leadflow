import * as Sentry from '@sentry/node';
import { logger } from './logger';
import { piiInTextMaskieren, piiMaskieren } from './pii-scrubber';

/**
 * Initialisiert Sentry fuer Error-Monitoring.
 * Nur aktiv wenn SENTRY_DSN gesetzt ist. In Entwicklung bleibt Sentry still.
 *
 * Muss VOR dem Erstellen der Express-App aufgerufen werden, damit Auto-Instrumentation
 * die Request-Handler umschliessen kann.
 */
export function sentryInitialisieren(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry nicht aktiv (SENTRY_DSN fehlt)');
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // PII (E-Mails, Telefon) standardmaessig nicht mitsenden – DSGVO
    sendDefaultPii: false,
    beforeSend(event) {
      // Webhooks und Health-Checks aus Breadcrumbs filtern – viel Rauschen, wenig Wert
      if (event.request?.url?.includes('/health')) return null;

      // PII-Scrubbing: E-Mail-Adressen und Telefonnummern in allen Feldern maskieren,
      // damit sie nicht ungewollt in Sentry landen (DSGVO Art. 5 Abs. 1 lit. c)
      if (event.message) event.message = piiInTextMaskieren(event.message);
      if (event.request?.url) event.request.url = piiInTextMaskieren(event.request.url);
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        event.request.query_string = piiInTextMaskieren(event.request.query_string);
      }
      if (event.extra) event.extra = piiMaskieren(event.extra) as typeof event.extra;
      if (event.tags) event.tags = piiMaskieren(event.tags) as typeof event.tags;
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          message: b.message ? piiInTextMaskieren(b.message) : b.message,
          data: b.data ? piiMaskieren(b.data) as typeof b.data : b.data,
        }));
      }
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((v) => ({
          ...v,
          value: v.value ? piiInTextMaskieren(v.value) : v.value,
        }));
      }
      return event;
    },
  });

  logger.info(`Sentry aktiv (${process.env.NODE_ENV})`);
  return true;
}

export { Sentry };
