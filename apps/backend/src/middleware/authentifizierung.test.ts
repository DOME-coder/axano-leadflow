import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { nurAdminOderMitarbeiter, kundenSelbstzugriff } from './authentifizierung';
import { AppFehler } from './fehlerbehandlung';

function baueKontext(benutzer: { rolle: string; kundeId?: string } | undefined, params: Record<string, string> = {}) {
  const req = { benutzer, params } as unknown as Request;
  const res = {} as Response;
  const nextMock = vi.fn();
  const next = nextMock as unknown as NextFunction;
  return { req, res, next, nextMock };
}

describe('nurAdminOderMitarbeiter', () => {
  it('laesst Admin durch', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'admin' });
    nurAdminOderMitarbeiter(req, res, next);
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('laesst Mitarbeiter durch', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'mitarbeiter' });
    nurAdminOderMitarbeiter(req, res, next);
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('blockt Kunde mit 403', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'kunde', kundeId: 'abc' });
    nurAdminOderMitarbeiter(req, res, next);
    const fehler = nextMock.mock.calls[0][0] as AppFehler;
    expect(fehler).toBeInstanceOf(AppFehler);
    expect(fehler.statusCode).toBe(403);
    expect(fehler.code).toBe('NICHT_AUTORISIERT');
  });

  it('blockt unauthentifizierten Zugriff', () => {
    const { req, res, next, nextMock } = baueKontext(undefined);
    nurAdminOderMitarbeiter(req, res, next);
    const fehler = nextMock.mock.calls[0][0] as AppFehler;
    expect(fehler).toBeInstanceOf(AppFehler);
    expect(fehler.statusCode).toBe(403);
  });
});

describe('kundenSelbstzugriff', () => {
  const middleware = kundenSelbstzugriff('kundeId');

  it('laesst Admin bei beliebigem kundeId durch', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'admin' }, { kundeId: 'fremder-kunde' });
    middleware(req, res, next);
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('laesst Mitarbeiter bei beliebigem kundeId durch', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'mitarbeiter' }, { kundeId: 'fremder-kunde' });
    middleware(req, res, next);
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('laesst Kunde bei eigenem kundeId durch', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'kunde', kundeId: 'mein-kunde' }, { kundeId: 'mein-kunde' });
    middleware(req, res, next);
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('blockt Kunde bei fremdem kundeId', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'kunde', kundeId: 'mein-kunde' }, { kundeId: 'fremder-kunde' });
    middleware(req, res, next);
    const fehler = nextMock.mock.calls[0][0] as AppFehler;
    expect(fehler).toBeInstanceOf(AppFehler);
    expect(fehler.statusCode).toBe(403);
  });

  it('blockt Kunde ohne kundeId im Token', () => {
    const { req, res, next, nextMock } = baueKontext({ rolle: 'kunde' }, { kundeId: 'irgend-was' });
    middleware(req, res, next);
    const fehler = nextMock.mock.calls[0][0] as AppFehler;
    expect(fehler).toBeInstanceOf(AppFehler);
    expect(fehler.statusCode).toBe(403);
  });

  it('blockt unauthentifizierten Zugriff mit 401', () => {
    const { req, res, next, nextMock } = baueKontext(undefined, { kundeId: 'egal' });
    middleware(req, res, next);
    const fehler = nextMock.mock.calls[0][0] as AppFehler;
    expect(fehler).toBeInstanceOf(AppFehler);
    expect(fehler.statusCode).toBe(401);
  });
});
