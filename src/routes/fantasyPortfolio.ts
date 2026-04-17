/**
 * Fantasy Portfolio Trading Routes
 * Handles buy/sell operations for fantasy portfolios
 */

import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';
import { getCurrentUser, getCurrentUserId } from '../services/currentUser';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { recalculateUserPortfolios, updatePortfolioTotalValue } from '../services/portfolioCalculator';
import { portfolioSnapshotService } from '../services/portfolioSnapshotService';
import { requireAuth } from '../middleware/auth';
import { tradeIdempotency, tradeRateLimit } from '../middleware/tradeProtection';

const router = Router();

// Apply authentication to all portfolio routes
router.use(requireAuth);

async function runSerializableTransaction<T>(work: () => Promise<T>): Promise<T> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await work();
    } catch (error: any) {
      const isSerializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

      if (!isSerializationConflict || attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw new Error('Failed to complete transaction');
}

// Validation schemas
const tradeSchema = z.object({
  groupId: z.string(),
  ticker: z.string().min(1).max(10).toUpperCase(),
  shares: z.number().positive(),
  tradeType: z.enum(['buy', 'sell']),
});

const allocateSchema = z.object({
  groupId: z.string(),
  assetType: z.enum(['savings', 'bonds', 'indexFunds']),
  amount: z.number(),
});

const BONDS_LOCK_DAYS = 30;

const hasCompetitionStarted = (settings: any): boolean => {
  if (!settings?.startDate) {
    return true;
  }
  const startDate = new Date(settings.startDate);
  if (Number.isNaN(startDate.getTime())) {
    return true;
  }
  return new Date() >= startDate;
};

/**
 * GET /api/fantasy-portfolio - Get current user's portfolios
 * Automatically recalculates portfolio values to ensure they're up-to-date
 */
router.get('/', async (req, res) => {
  try {
    const user = await getCurrentUser(req);

    // Recalculate portfolio values to ensure they're accurate with latest stock prices
    await recalculateUserPortfolios(user.id);

    const portfolios = await prisma.fantasyPortfolio.findMany({
      where: { userId: user.id },
      include: {
        group: true,
        slots: {
          include: {
            asset: true,
          },
        },
      },
    });

    res.json(portfolios);
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fantasy-portfolio/:groupId - Get portfolio for specific group
 */
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getCurrentUserId(req);

    const portfolioRef = await prisma.fantasyPortfolio.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!portfolioRef) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    await updatePortfolioTotalValue(portfolioRef.id);

    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      include: {
        group: true,
        slots: {
          include: {
            asset: true,
          },
        },
      },
    });

    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/fantasy-portfolio/trade - Execute a buy or sell trade
 */
router.post('/trade', tradeRateLimit(60_000, 20), tradeIdempotency(), async (req, res) => {
  try {
    const validated = tradeSchema.parse(req.body);
    const { groupId, ticker, shares, tradeType } = validated;
    const userId = await getCurrentUserId(req);

    // Get the asset
    const asset = await prisma.asset.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const currentPrice = Number(asset.currentPrice);
    const tradeAmount = currentPrice * shares;

    if (tradeType === 'buy') {
      const result = await runSerializableTransaction(async () => {
        return prisma.$transaction(
          async (tx) => {
            const lockedPortfolio = await tx.fantasyPortfolio.findUnique({
              where: {
                groupId_userId: {
                  groupId,
                  userId,
                },
              },
              include: {
                slots: {
                  where: { assetId: asset.id },
                },
              },
            });

            if (!lockedPortfolio) {
              throw new Error('Portfolio not found');
            }

            const cashBalance = Number(lockedPortfolio.cashBalance);
            if (cashBalance < tradeAmount) {
              throw new Error('Insufficient cash balance');
            }

            const slot = lockedPortfolio.slots[0];
            let returnedSlot: any = null;
            let newCashBalance = cashBalance;
            let newTotalValue = Number(lockedPortfolio.totalValue);

            if (slot) {
              const currentShares = Number(slot.shares);
              const currentAvgCost = Number(slot.averageCost);
              const newShares = currentShares + shares;
              const newAvgCost = (currentShares * currentAvgCost + tradeAmount) / newShares;

              returnedSlot = await tx.portfolioSlot.update({
                where: { id: slot.id },
                data: {
                  shares: new Decimal(newShares),
                  averageCost: new Decimal(newAvgCost),
                  currentPrice: asset.currentPrice,
                  totalValue: new Decimal(newShares * currentPrice),
                  gainLoss: new Decimal(newShares * currentPrice - newShares * newAvgCost),
                  gainLossPercent: new Decimal(
                    ((newShares * currentPrice - newShares * newAvgCost) / (newShares * newAvgCost)) * 100
                  ),
                },
                include: {
                  asset: true,
                },
              });

              newCashBalance = cashBalance - tradeAmount;
              newTotalValue = newCashBalance + newShares * currentPrice;
            } else {
              returnedSlot = await tx.portfolioSlot.create({
                data: {
                  portfolioId: lockedPortfolio.id,
                  assetId: asset.id,
                  shares: new Decimal(shares),
                  averageCost: new Decimal(currentPrice),
                  currentPrice: asset.currentPrice,
                  totalValue: new Decimal(shares * currentPrice),
                  gainLoss: new Decimal(0),
                  gainLossPercent: new Decimal(0),
                },
                include: {
                  asset: true,
                },
              });

              newCashBalance = cashBalance - tradeAmount;
              newTotalValue = newCashBalance + shares * currentPrice;
            }

            await tx.fantasyPortfolio.update({
              where: { id: lockedPortfolio.id },
              data: {
                cashBalance: new Decimal(newCashBalance),
                totalValue: new Decimal(newTotalValue),
              },
            });

            await tx.fantasyPortfolioTransaction.create({
              data: {
                portfolioId: lockedPortfolio.id,
                assetId: asset.id,
                type: 'buy',
                shares: new Decimal(shares),
                pricePerShare: asset.currentPrice,
                totalAmount: new Decimal(tradeAmount),
                cashBefore: lockedPortfolio.cashBalance,
                cashAfter: new Decimal(newCashBalance),
              },
            });

            return {
              success: true,
              slot: returnedSlot,
              portfolio: {
                cashBalance: newCashBalance,
                totalValue: newTotalValue,
              },
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      });

      return res.json(result);
    } else if (tradeType === 'sell') {
      const result = await runSerializableTransaction(async () => {
        return prisma.$transaction(
          async (tx) => {
            const lockedPortfolio = await tx.fantasyPortfolio.findUnique({
              where: {
                groupId_userId: {
                  groupId,
                  userId,
                },
              },
              include: {
                slots: {
                  where: { assetId: asset.id },
                },
              },
            });

            if (!lockedPortfolio) {
              throw new Error('Portfolio not found');
            }

            const slot = lockedPortfolio.slots[0];
            if (!slot) {
              throw new Error('No holdings to sell');
            }

            const currentShares = Number(slot.shares);
            if (currentShares < shares) {
              throw new Error('Insufficient shares to sell');
            }

            const newShares = currentShares - shares;
            const cashBalance = Number(lockedPortfolio.cashBalance);
            const newCashBalance = cashBalance + tradeAmount;
            let newTotalValue = newCashBalance;
            let returnedSlot: any = null;

            if (newShares === 0) {
              await tx.portfolioSlot.delete({
                where: { id: slot.id },
              });
            } else {
              const avgCost = Number(slot.averageCost);
              returnedSlot = await tx.portfolioSlot.update({
                where: { id: slot.id },
                data: {
                  shares: new Decimal(newShares),
                  currentPrice: asset.currentPrice,
                  totalValue: new Decimal(newShares * currentPrice),
                  gainLoss: new Decimal(newShares * currentPrice - newShares * avgCost),
                  gainLossPercent: new Decimal(
                    ((newShares * currentPrice - newShares * avgCost) / (newShares * avgCost)) * 100
                  ),
                },
                include: {
                  asset: true,
                },
              });
              newTotalValue = newCashBalance + newShares * currentPrice;
            }

            await tx.fantasyPortfolio.update({
              where: { id: lockedPortfolio.id },
              data: {
                cashBalance: new Decimal(newCashBalance),
                totalValue: new Decimal(newTotalValue),
              },
            });

            await tx.fantasyPortfolioTransaction.create({
              data: {
                portfolioId: lockedPortfolio.id,
                assetId: asset.id,
                type: 'sell',
                shares: new Decimal(shares),
                pricePerShare: asset.currentPrice,
                totalAmount: new Decimal(tradeAmount),
                cashBefore: lockedPortfolio.cashBalance,
                cashAfter: new Decimal(newCashBalance),
              },
            });

            return {
              success: true,
              slot: returnedSlot,
              portfolio: {
                cashBalance: newCashBalance,
                totalValue: newTotalValue,
              },
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      });

      return res.json(result);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Trade conflict, please retry' });
    }
    if (error instanceof Error) {
      if (error.message === 'Insufficient cash balance') {
        return res.status(400).json({ error: 'Insufficient cash balance' });
      }
      if (error.message === 'No holdings to sell') {
        return res.status(400).json({ error: 'No holdings to sell' });
      }
      if (error.message === 'Insufficient shares to sell') {
        return res.status(400).json({ error: 'Insufficient shares to sell' });
      }
    }
    console.error('Error executing trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/fantasy-portfolio/recalculate - Manually recalculate portfolio balances
 * Useful for ensuring portfolio values are synced with latest stock prices
 */
router.post('/recalculate', async (req, res) => {
  try {
    const userId = await getCurrentUserId(req);
    
    console.log(`📊 Recalculating portfolios for user ${userId}...`);
    await recalculateUserPortfolios(userId);

    const portfolios = await prisma.fantasyPortfolio.findMany({
      where: { userId },
      select: {
        id: true,
        groupId: true,
        cashBalance: true,
        totalValue: true,
      },
    });

    console.log(`✅ Recalculated ${portfolios.length} portfolios`);

    res.json({
      success: true,
      message: `Recalculated ${portfolios.length} portfolios`,
      portfolios,
    });
  } catch (error) {
    console.error('Error recalculating portfolios:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/fantasy-portfolio/allocate - Allocate funds to savings/bonds/index funds
 */
router.post('/allocate', async (req, res) => {
  try {
    const validated = allocateSchema.parse(req.body);
    const { groupId, assetType, amount } = validated;
    const userId = await getCurrentUserId(req);

    // Get the portfolio
    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const settings = group.settings ? JSON.parse(group.settings) : {};
    if (!hasCompetitionStarted(settings)) {
      return res.status(403).json({ error: 'Competition has not started yet' });
    }
    const classMap: Record<string, string> = {
      savings: 'Savings Account',
      bonds: 'Bonds',
      indexFunds: 'Index Funds',
    };
    const requiredClass = classMap[assetType];
    if (
      requiredClass &&
      settings.enabledAssetClasses &&
      settings.enabledAssetClasses.length > 0 &&
      !settings.enabledAssetClasses.includes(requiredClass)
    ) {
      return res.status(403).json({ error: `${requiredClass} is not enabled for this group` });
    }

    // Map asset type to database field name
    const fieldMap: Record<string, keyof typeof portfolio> = {
      savings: 'savingsAccount',
      bonds: 'bonds',
      indexFunds: 'indexFunds',
    };

    const fieldName = fieldMap[assetType];

    const cashBalance = Number(portfolio.cashBalance);
    const currentAllocation = Number(portfolio[fieldName] || 0);
    const now = new Date();
    const existingBondLock = portfolio.bondsLockedUntil ? new Date(portfolio.bondsLockedUntil) : null;

    if (assetType === 'bonds' && amount < 0 && existingBondLock && existingBondLock > now) {
      return res.status(400).json({
        error: 'Bonds are locked',
        message: `Bonds are locked until ${existingBondLock.toLocaleDateString()}.`,
        lockedUntil: existingBondLock.toISOString(),
      });
    }

    // If amount is positive, we're buying (moving from cash)
    // If amount is negative, we're selling (moving to cash)
    if (amount > 0 && cashBalance < amount) {
      return res.status(400).json({ error: 'Insufficient cash balance' });
    }

    if (amount < 0 && currentAllocation < Math.abs(amount)) {
      return res.status(400).json({ error: 'Insufficient allocation to sell' });
    }

    const newCashBalance = cashBalance - amount;
    const newAllocation = currentAllocation + amount;

    const updateData: any = {
      cashBalance: new Decimal(newCashBalance),
      [fieldName]: new Decimal(newAllocation),
    };

    if (assetType === 'bonds') {
      if (amount > 0) {
        const newLock = new Date(now.getTime() + BONDS_LOCK_DAYS * 24 * 60 * 60 * 1000);
        updateData.bondsLockedUntil =
          existingBondLock && existingBondLock > newLock ? existingBondLock : newLock;
      } else if (newAllocation <= 0) {
        updateData.bondsLockedUntil = null;
      }
    }

    const updatedPortfolio = await prisma.fantasyPortfolio.update({
      where: { id: portfolio.id },
      data: updateData,
    });

    await updatePortfolioTotalValue(portfolio.id);

    res.json({
      success: true,
      portfolio: {
        cashBalance: newCashBalance,
        [assetType]: newAllocation,
        bondsLockedUntil: updatedPortfolio.bondsLockedUntil,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
    }
    console.error('Error allocating funds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fantasy-portfolio/:groupId/history - Get historical portfolio performance
 * Returns daily snapshots with market baseline comparisons
 */
router.get('/:groupId/history', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const { groupId } = req.params;
    const { startDate, endDate, timeFrame } = req.query;

    // Find the portfolio for this user and group
    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Keep persisted total value in sync with latest holdings before building history.
    const refreshedTotalValue = Number(await updatePortfolioTotalValue(portfolio.id));

    // Parse date filters if provided
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && typeof startDate === 'string') {
      start = new Date(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      end = new Date(endDate);
    }

    // Or use timeFrame to calculate date range
    if (timeFrame && typeof timeFrame === 'string') {
      const now = new Date();
      const frames: Record<string, number> = {
        '1D': 1,
        '1W': 7,
        '1M': 30,
        '3M': 90,
        '1Y': 365,
        '5Y': 1825,
      };

      if (timeFrame === 'YTD') {
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
      } else if (frames[timeFrame]) {
        start = new Date(now.getTime() - frames[timeFrame] * 24 * 60 * 60 * 1000);
        end = now;
      }
    }

    // Get historical snapshots
    const history = await portfolioSnapshotService.getPortfolioHistory(
      portfolio.id,
      start,
      end
    );

    // Get current breakdown from live holdings for an accurate "now" point.
    const portfolioWithSlots = await prisma.fantasyPortfolio.findUnique({
      where: { id: portfolio.id },
      include: { slots: { include: { asset: true } } },
    });
    const currentCash = Number(portfolioWithSlots?.cashBalance ?? portfolio.cashBalance);
    const currentStockValue = portfolioWithSlots?.slots.reduce((sum, slot) =>
      sum + Number(slot.shares) * Number(slot.asset.currentPrice), 0) || 0;
    const currentValue = refreshedTotalValue > 0 ? refreshedTotalValue : currentCash + currentStockValue;

    // Handle edge case: if we have limited data, add current portfolio state as a data point
    if (history.length === 0) {
      // No snapshots yet - return current portfolio value as single data point
      const initialValue = Number(portfolio.initialValue) > 0 ? Number(portfolio.initialValue) : currentValue;
      const now = new Date();
      
      // Calculate what S&P 500 baseline would be
      const daysSinceCreation = (now.getTime() - portfolio.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const sp500Value = initialValue * Math.pow(1.10, daysSinceCreation / 365);
      
      history.push({
        date: now,
        totalValue: currentValue,
        cashBalance: currentCash,
        stockValue: currentStockValue,
        dayChange: currentValue - initialValue,
        dayChangePercent: initialValue > 0 ? ((currentValue - initialValue) / initialValue) * 100 : 0,
        sp500Value,
        nasdaqValue: initialValue * Math.pow(1.12, daysSinceCreation / 365),
        dowValue: initialValue * Math.pow(1.08, daysSinceCreation / 365),
      });
    } else {
      const latest = history[history.length - 1];
      const latestValue = Number(latest.totalValue);
      const latestTimestamp = new Date(latest.date).getTime();
      const now = Date.now();
      const shouldAppendCurrentPoint =
        Math.abs(latestValue - currentValue) > 0.01 ||
        now - latestTimestamp > 60 * 60 * 1000;

      if (shouldAppendCurrentPoint && (!end || now <= end.getTime())) {
        const previousValue = Number.isFinite(latestValue) ? latestValue : currentValue;
        history.push({
          date: new Date(now),
          totalValue: currentValue,
          cashBalance: currentCash,
          stockValue: currentStockValue,
          dayChange: currentValue - previousValue,
          dayChangePercent: previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0,
          sp500Value: Number(latest.sp500Value) || Number(portfolio.initialValue) || currentValue,
          nasdaqValue: Number(latest.nasdaqValue) || Number(portfolio.initialValue) || currentValue,
          dowValue: Number(latest.dowValue) || Number(portfolio.initialValue) || currentValue,
        });
      }
    }

    res.json({
      portfolioId: portfolio.id,
      groupId,
      history,
      baselines: {
        sp500: history.map(h => ({ date: h.date, value: h.sp500Value })),
        nasdaq: history.map(h => ({ date: h.date, value: h.nasdaqValue })),
        dow: history.map(h => ({ date: h.date, value: h.dowValue })),
      },
    });
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/fantasy-portfolio/snapshots/take-now - Manually trigger daily snapshot (admin/testing)
 */
router.post('/snapshots/take-now', async (req, res) => {
  try {
    await portfolioSnapshotService.takeDailySnapshots();
    res.json({ success: true, message: 'Daily snapshots taken successfully' });
  } catch (error) {
    console.error('Error taking snapshots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

