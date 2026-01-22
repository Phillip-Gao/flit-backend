/**
 * Current User Service
 * Tracks the currently logged-in user (hardcoded to phillipgao for now)
 * TODO: Replace with proper authentication system later
 */

import prisma from './prisma';

/**
 * Get the current logged-in user
 * For now, this is hardcoded to phillipgao
 * TODO: Replace with actual authentication/session management
 */
export async function getCurrentUser() {
  const user = await prisma.user.findUnique({
    where: { username: 'phillipgao' },
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
    throw new Error('User phillipgao not found. Please run seed script.');
  }

  return user;
}

/**
 * Get current user's ID
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}

/**
 * Get current user's portfolios
 */
export async function getCurrentUserPortfolios() {
  const user = await getCurrentUser();
  return user.fantasyPortfolios;
}

/**
 * Get specific portfolio by group ID for current user
 */
export async function getCurrentUserPortfolioByGroup(groupId: string) {
  const user = await getCurrentUser();
  const portfolio = user.fantasyPortfolios.find((p) => p.groupId === groupId);
  
  if (!portfolio) {
    throw new Error(`Portfolio not found for group ${groupId}`);
  }
  
  return portfolio;
}
