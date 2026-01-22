import { Request, Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import prisma from '../services/prisma';

// Extend Express Request type to include auth info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      clerkUserId?: string;
    }
  }
}

// Middleware that requires authentication
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be signed in to access this resource',
      });
    }

    // Find the database user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found. Please sync your account.',
      });
    }

    // Attach user info to request
    req.userId = user.id;
    req.clerkUserId = auth.userId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
};

// Middleware that optionally attaches user if authenticated
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);

    if (auth.userId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
      });

      if (user) {
        req.userId = user.id;
        req.clerkUserId = auth.userId;
      }
    }

    next();
  } catch (error) {
    // Continue without auth if there's an error
    console.error('Optional auth middleware error:', error);
    next();
  }
};
