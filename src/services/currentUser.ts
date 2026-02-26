/**
 * Current User Service
 * Gets the authenticated user from the request context
 */

import { Request } from 'express';
import prisma from './prisma';

/**
 * Get the current logged-in user from request
 * Requires that requireAuth or optionalAuth middleware has been applied
 */
export async function getCurrentUser(req: Request) {
  const userId = req.userId;

  if (!userId) {
    throw new Error('User not authenticated. Please sign in.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      fantasyPortfolios: {
        include: {
          group: true,
          slots: {
            include: {
              asset: true,
            },
          },
        },
      },
      groupMemberships: {
        include: {
          group: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found in database.');
  }

  return user;
}

/**
 * Get current user's ID from request
 */
export async function getCurrentUserId(req: Request): Promise<string> {
  const userId = req.userId;

  if (!userId) {
    throw new Error('User not authenticated. Please sign in.');
  }

  return userId;
}

/**
 * Get current user's portfolios
 */
export async function getCurrentUserPortfolios(req: Request) {
  const user = await getCurrentUser(req);
  return user.fantasyPortfolios;
}

/**
 * Get specific portfolio by group ID for current user
 */
export async function getCurrentUserPortfolioByGroup(req: Request, groupId: string) {
  const user = await getCurrentUser(req);
  const portfolio = user.fantasyPortfolios.find((p) => p.groupId === groupId);
  
  if (!portfolio) {
    throw new Error(`Portfolio not found for group ${groupId}`);
  }
  
  return portfolio;
}
