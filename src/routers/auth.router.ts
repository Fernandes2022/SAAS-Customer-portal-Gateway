import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/signup', AuthController.signup);
authRouter.post('/login', AuthController.login);
authRouter.post('/dev/issue-token', AuthController.issueDevToken);


