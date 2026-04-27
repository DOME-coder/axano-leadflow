import dotenv from 'dotenv';
dotenv.config();

import { sentryInitialisieren, Sentry } from './hilfsfunktionen/sentry';
sentryInitialisieren();

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { globaleFehlerbehebung } from './middleware/fehlerbehandlung';
import { healthRouter } from './routen/health.routen';
import { authRouter } from './routen/auth.routen';
import { kampagnenRouter } from './routen/kampagnen.routen';
import { kundenRouter } from './routen/kunden.routen';
import { promptVorlagenRouter } from './routen/prompt-vorlagen.routen';
import { leadsRouter, kampagneLeadsRouter } from './routen/leads.routen';
import { webhooksRouter } from './routen/webhooks.routen';
import { demoRouter } from './routen/demo.routen';
import { kampagneAutomatisierungenRouter, automatisierungenRouter } from './routen/automatisierungen.routen';
import { templatesRouter } from './routen/templates.routen';
import { integrationenRouter } from './routen/integrationen.routen';
import { analyticsRouter } from './routen/analytics.routen';
import { benutzerRouter } from './routen/benutzer.routen';
import { anrufeRouter, kampagneAnrufeRouter } from './routen/anrufe.routen';
import { termineRouter } from './routen/termine.routen';
import { testRouter } from './routen/test.routen';
import { kundenIntegrationenRouter } from './routen/kunden-integrationen.routen';
import { oauthRouter } from './routen/oauth.routen';
import { socketServerInitialisieren } from './websocket/socket.handler';
import { workerStarten } from './jobs/automatisierung.job';
import { emailPollingStarten } from './jobs/email-polling.job';
import { anrufWorkerStarten } from './jobs/anruf.job';
import { followUpWorkerStarten } from './jobs/followup.job';
import { anrufPollingWorkerStarten } from './jobs/anruf-polling.job';
import { automatisierungSchedulerStarten } from './jobs/automatisierung-scheduler.job';
import { logger } from './hilfsfunktionen/logger';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Hinter Coolify-Nginx-Proxy: dem ersten Hop vertrauen, damit X-Forwarded-For
// korrekt gelesen wird. Sonst zaehlt express-rate-limit alle Requests gegen
// eine einzige IP (die des Proxies) — das wuerde die ganze Plattform global
// drosseln statt pro Client zu zaehlen.
app.set('trust proxy', 1);

// WebSocket initialisieren
socketServerInitialisieren(httpServer);

// Automatisierungs-Worker starten
workerStarten();

// E-Mail-Polling starten (IMAP, alle 2 Minuten)
emailPollingStarten();

// Anruf-Worker starten (VAPI AI-Anrufe)
anrufWorkerStarten();

// Follow-up-Worker starten (verzögerte E-Mail/WhatsApp)
followUpWorkerStarten();

// Anruf-Polling-Worker starten (VAPI-Ergebnisse abholen)
anrufPollingWorkerStarten();

// Automatisierung-Scheduler starten (Inaktivität & Zeitplan, alle 5 Minuten)
automatisierungSchedulerStarten();

// Middleware-Stack
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3001',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({
  limit: '10mb',
  // Roh-Body speichern, damit Webhook-Signaturen geprueft werden koennen (Meta HMAC)
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}));
app.use(cookieParser());
app.use(morgan('combined', {
  stream: { write: (nachricht: string) => logger.info(nachricht.trim()) },
}));

// Rate Limiting (max 100 Requests/Min pro IP)
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erfolg: false, fehler: 'Zu viele Anfragen – bitte warten.' },
});
app.use('/api/v1', rateLimiter);

// Routen
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/kampagnen', kampagnenRouter);
// WICHTIG: Kunden-Integrationen-Router MUSS vor kundenRouter registriert werden,
// sonst fangen die kundenRouter-Middlewares (nurAdminOderMitarbeiter) die Anfrage
// vom Kunden-Selfservice-Portal ab und antworten mit 403.
app.use('/api/v1/kunden/:kundeId/integrationen', kundenIntegrationenRouter);
app.use('/api/v1/kunden', kundenRouter);
app.use('/api/v1/prompt-vorlagen', promptVorlagenRouter);
app.use('/api/v1/kampagnen/:kampagneId/leads', kampagneLeadsRouter);
app.use('/api/v1/kampagnen/:kampagneId/automatisierungen', kampagneAutomatisierungenRouter);
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/automatisierungen', automatisierungenRouter);
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1/integrationen', integrationenRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/benutzer', benutzerRouter);
app.use('/api/v1/kampagnen/:kampagneId/anrufe', kampagneAnrufeRouter);
app.use('/api/v1/anrufe', anrufeRouter);
app.use('/api/v1/termine', termineRouter);
app.use('/api/v1/oauth', oauthRouter);
app.use('/api/v1/test', testRouter);
app.use('/api/v1/webhooks', webhooksRouter);
app.use('/api/v1/demo', demoRouter);

// Sentry-Error-Handler vor globaler Fehlerbehandlung (nur wirksam wenn SENTRY_DSN gesetzt)
Sentry.setupExpressErrorHandler(app);

// Globale Fehlerbehandlung
app.use(globaleFehlerbehebung);

httpServer.listen(PORT, () => {
  logger.info(`Backend-Server läuft auf Port ${PORT}`);
});

export default app;
