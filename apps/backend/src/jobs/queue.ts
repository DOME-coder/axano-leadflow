import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../hilfsfunktionen/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisVerbindung = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisVerbindung.on('error', (fehler) => {
  logger.error('Redis-Verbindungsfehler:', { message: fehler.message });
});

redisVerbindung.on('connect', () => {
  logger.info('Redis verbunden');
});

export const automatisierungsQueue = new Queue('automatisierungen', {
  connection: redisVerbindung,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const emailPollingQueue = new Queue('email-polling', {
  connection: redisVerbindung,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const followUpQueue = new Queue('follow-ups', {
  connection: redisVerbindung,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const anrufQueue = new Queue('anrufe', {
  connection: redisVerbindung,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 10000 },
  },
});
