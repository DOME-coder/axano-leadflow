import { Router, Request, Response, NextFunction } from 'express';
import { authentifizierung } from '../middleware/authentifizierung';
import { plattformUebersicht, kampagnenAnalytics } from '../dienste/analytics.dienst';

export const analyticsRouter = Router();
analyticsRouter.use(authentifizierung);

// GET /api/v1/analytics/uebersicht
analyticsRouter.get('/uebersicht', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kundeId = typeof req.query.kunde_id === 'string' ? req.query.kunde_id : undefined;
    const daten = await plattformUebersicht(kundeId);
    res.json({ erfolg: true, daten });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/analytics/kampagnen/:id
analyticsRouter.get('/kampagnen/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const zeitraum = typeof req.query.zeitraum === 'string' ? req.query.zeitraum : 'woche';
    const daten = await kampagnenAnalytics(req.params.id, zeitraum);
    res.json({ erfolg: true, daten });
  } catch (fehler) {
    next(fehler);
  }
});
