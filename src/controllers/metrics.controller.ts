import { Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { MetricsService } from '../services/metrics.service';

export class MetricsController {
  static async overview(req: AuthenticatedRequest, res: Response) {
    const userId = req.auth!.sub;
    const data = await MetricsService.getOverview(userId);
    res.json(data);
  }
}

