import { Router } from 'express';
import { PlansController } from '../controllers/plans.controller';

export const plansRouter = Router();

// Public endpoint - no auth required to view pricing
plansRouter.get('/api/v1/plans', PlansController.getAllPlans);

