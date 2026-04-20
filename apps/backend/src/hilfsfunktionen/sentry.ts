import * as Sentry from '@sentry/node';
import { logger } from './logger';

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
      return event;
    },
  });

  logger.info(`Sentry aktiv (${process.env.NODE_ENV})`);
  return true;
}

export { Sentry };
