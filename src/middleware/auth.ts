import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware placeholder
 * TODO: Integrate with Clerk authentication
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // TODO: Add Clerk authentication verification here
    // For now, this is a placeholder
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
