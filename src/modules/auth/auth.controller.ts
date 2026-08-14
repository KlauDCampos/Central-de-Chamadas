import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const resultado = await authService.register(req.body);
      res.status(201).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const resultado = await authService.login(req.body);
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },
};
