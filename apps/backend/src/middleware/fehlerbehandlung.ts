import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../hilfsfunktionen/logger';

interface ApiFehlermeldung {
  erfolg: false;
  fehler: string;
  details?: Array<{ feld: string; nachricht: string }>;
  code: string;
}

export class AppFehler extends Error {
  public statusCode: number;
  public code: string;

  constructor(nachricht: string, statusCode: number, code: string) {
    super(nachricht);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppFehler';
  }
}

export function globaleFehlerbehebung(
  fehler: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Fehler aufgetreten:', {
    name: fehler.name,
    message: fehler.message,
    stack: fehler.stack,
  });

  if (fehler instanceof AppFehler) {
    const antwort: ApiFehlermeldung = {
      erfolg: false,
      fehler: fehler.message,
      code: fehler.code,
    };
    res.status(fehler.statusCode).json(antwort);
    return;
  }

  if (fehler instanceof ZodError) {
    const details = fehler.errors.map((err) => ({
      feld: err.path.join('.'),
      nachricht: err.message,
    }));
    const antwort: ApiFehlermeldung = {
      erfolg: false,
      fehler: 'Validierungsfehler',
      details,
      code: 'VALIDIERUNGSFEHLER',
    };
    res.status(400).json(antwort);
    return;
  }

  const antwort: ApiFehlermeldung = {
    erfolg: false,
    fehler: 'Interner Serverfehler',
    code: 'INTERNER_FEHLER',
  };
  res.status(500).json(antwort);
}
