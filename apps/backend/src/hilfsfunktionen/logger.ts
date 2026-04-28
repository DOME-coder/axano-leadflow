import winston from 'winston';
import { piiMaskieren, piiInTextMaskieren } from './pii-scrubber';

/**
 * PII-Scrubbing-Format: Maskiert E-Mail-Adressen und Telefonnummern in Logs
 * (DSGVO Art. 5 Abs. 1 lit. c — Datenminimierung). Wird in Produktion und
 * Development gleichermassen aktiv, weil Dev-Logs auch in Sentry/Filesysteme
 * landen koennen.
 */
const piiScrubbingFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = piiInTextMaskieren(info.message);
  }
  // Alle weiteren Felder rekursiv durchgehen
  for (const schluessel of Object.keys(info)) {
    if (schluessel === 'message' || schluessel === 'level' || schluessel === 'timestamp') continue;
    info[schluessel] = piiMaskieren(info[schluessel]);
  }
  return info;
})();

const logFormat = winston.format.combine(
  piiScrubbingFormat,
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  process.env.NODE_ENV === 'development'
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    : winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { dienst: 'axano-leadflow' },
  transports: [
    new winston.transports.Console(),
  ],
});
