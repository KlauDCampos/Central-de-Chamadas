import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/indicadores', authMiddleware, dashboardController.indicadores);
router.get('/stream', authMiddleware, dashboardController.stream);

export default router;
