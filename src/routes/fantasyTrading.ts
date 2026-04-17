import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { getCurrentUserId } from '../services/currentUser';
import { tradeIdempotency, tradeRateLimit } from '../middleware/tradeProtection';
import { updatePortfolioTotalValue } from '../services/portfolioCalculator';

const router = Router();

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
const buyAssetSchema = z.object({
  assetId: z.string(),
  shares: z.number().positive(),
});

const sellAssetSchema = z.object({
  assetId: z.string(),
  shares: z.number().positive(),
});

// POST /api/fantasy-leagues/:groupId/buy - Buy an asset
router.post('/:groupId/buy', tradeRateLimit(60_000, 20), tradeIdempotency(), async (req, res) => {
  try {
    const { groupId } = req.params;
    const validated = buyAssetSchema.parse(req.body);
    const userId = await getCurrentUserId(req);

    // Get user's portfolio
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
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Get asset current price
    const asset = await prisma.asset.findUnique({
      where: { id: validated.assetId },
    });

    if (!asset || !asset.isActive) {
      return res.status(404).json({ error: 'Asset not found or inactive' });
    }

    // Check group settings
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const settings = group.settings ? JSON.parse(group.settings) : {};

    // Check if trading is enabled
    if (settings.tradingEnabled === false) {
      return res.status(403).json({ error: 'Trading is disabled for this group' });
    }

    // Check if asset class is allowed
    if (settings.enabledAssetClasses && settings.enabledAssetClasses.length > 0) {
      if (!settings.enabledAssetClasses.includes('Stock')) {
        return res.status(403).json({
          error: 'Stock trading is not enabled for this group'
        });
      }
    }

    // Check minimum asset price
    if (settings.minAssetPrice && parseFloat(asset.currentPrice.toString()) < settings.minAssetPrice) {
      return res.status(403).json({
        error: `Asset price is below group minimum of $${settings.minAssetPrice}`
      });
    }

    // Calculate total cost
    const pricePerShare = new Decimal(asset.currentPrice.toString());
    const sharesToBuy = new Decimal(validated.shares);
    const totalCost = pricePerShare.times(sharesToBuy);

    // Check if user has enough cash
    const cashBalance = new Decimal(portfolio.cashBalance.toString());
    if (cashBalance.lessThan(totalCost)) {
      return res.status(400).json({
        error: 'Insufficient funds',
        required: totalCost.toNumber(),
        available: cashBalance.toNumber(),
      });
    }

    // Check lesson gating
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedLessons: true },
    });

    if (asset.requiredLessons.length > 0 && user) {
      const missingLessons = asset.requiredLessons.filter(
        (lessonId) => !user.completedLessons.includes(lessonId)
      );

      if (missingLessons.length > 0) {
        return res.status(403).json({
          error: 'Asset locked',
          code: 'LESSON_REQUIRED',
          missingLessons,
        });
      }
    }

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
          });

          if (!lockedPortfolio) {
            throw new Error('Portfolio not found');
          }

          const latestCashBalance = new Decimal(lockedPortfolio.cashBalance.toString());
          if (latestCashBalance.lessThan(totalCost)) {
            throw new Error('Insufficient funds');
          }

          const existingSlot = await tx.portfolioSlot.findUnique({
            where: {
              portfolioId_assetId: {
                portfolioId: lockedPortfolio.id,
                assetId: validated.assetId,
              },
            },
          });

          let newAverageCost: Decimal;
          let newShares: Decimal;

          if (existingSlot) {
            const currentShares = new Decimal(existingSlot.shares.toString());
            const currentAverageCost = new Decimal(existingSlot.averageCost.toString());
            const currentTotalCost = currentShares.times(currentAverageCost);

            newShares = currentShares.plus(sharesToBuy);
            const newTotalCost = currentTotalCost.plus(totalCost);
            newAverageCost = newTotalCost.dividedBy(newShares);

            await tx.portfolioSlot.update({
              where: { id: existingSlot.id },
              data: {
                shares: newShares.toNumber(),
                averageCost: newAverageCost.toNumber(),
                currentPrice: pricePerShare.toNumber(),
              },
            });
          } else {
            newShares = sharesToBuy;
            newAverageCost = pricePerShare;

            await tx.portfolioSlot.create({
              data: {
                portfolioId: lockedPortfolio.id,
                assetId: validated.assetId,
                shares: newShares.toNumber(),
                averageCost: newAverageCost.toNumber(),
                currentPrice: pricePerShare.toNumber(),
              },
            });
          }

          const newCashBalance = latestCashBalance.minus(totalCost);
          await tx.fantasyPortfolio.update({
            where: { id: lockedPortfolio.id },
            data: {
              cashBalance: newCashBalance.toNumber(),
            },
          });

          const transaction = await tx.fantasyPortfolioTransaction.create({
            data: {
              portfolioId: lockedPortfolio.id,
              assetId: validated.assetId,
              type: 'buy',
              shares: sharesToBuy.toNumber(),
              pricePerShare: pricePerShare.toNumber(),
              totalAmount: totalCost.toNumber(),
              cashBefore: latestCashBalance.toNumber(),
              cashAfter: newCashBalance.toNumber(),
            },
          });

          return {
            transaction,
            newCashBalance: newCashBalance.toNumber(),
            newShares: newShares.toNumber(),
            averageCost: newAverageCost.toNumber(),
            portfolioId: lockedPortfolio.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    });

    await updatePortfolioTotalValue(result.portfolioId);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Trade conflict, please retry' });
    }
    if (error instanceof Error && error.message === 'Insufficient funds') {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    console.error('Error buying asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:groupId/sell - Sell an asset
router.post('/:groupId/sell', tradeRateLimit(60_000, 20), tradeIdempotency(), async (req, res) => {
  try {
    const { groupId } = req.params;
    const validated = sellAssetSchema.parse(req.body);
    const userId = await getCurrentUserId(req);

    // Get user's portfolio
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

    // Check group settings
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const settings = group.settings ? JSON.parse(group.settings) : {};

    // Check if trading is enabled
    if (settings.tradingEnabled === false) {
      return res.status(403).json({ error: 'Trading is disabled for this group' });
    }

    if (settings.enabledAssetClasses && settings.enabledAssetClasses.length > 0) {
      if (!settings.enabledAssetClasses.includes('Stock')) {
        return res.status(403).json({ error: 'Stock trading is not enabled for this group' });
      }
    }

    // Get portfolio slot
    const slot = await prisma.portfolioSlot.findUnique({
      where: {
        portfolioId_assetId: {
          portfolioId: portfolio.id,
          assetId: validated.assetId,
        },
      },
      include: {
        asset: true,
      },
    });

    if (!slot) {
      return res.status(404).json({ error: 'Asset not found in portfolio' });
    }

    // Check if user has enough shares
    const currentShares = new Decimal(slot.shares.toString());
    const sharesToSell = new Decimal(validated.shares);

    if (currentShares.lessThan(sharesToSell)) {
      return res.status(400).json({
        error: 'Insufficient shares',
        requested: sharesToSell.toNumber(),
        available: currentShares.toNumber(),
      });
    }

    // Calculate sale proceeds
    const pricePerShare = new Decimal(slot.asset.currentPrice.toString());
    const totalProceeds = pricePerShare.times(sharesToSell);

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
          });

          if (!lockedPortfolio) {
            throw new Error('Portfolio not found');
          }

          const lockedSlot = await tx.portfolioSlot.findUnique({
            where: {
              portfolioId_assetId: {
                portfolioId: lockedPortfolio.id,
                assetId: validated.assetId,
              },
            },
            include: {
              asset: true,
            },
          });

          if (!lockedSlot) {
            throw new Error('Asset not found in portfolio');
          }

          const currentShares = new Decimal(lockedSlot.shares.toString());
          if (currentShares.lessThan(sharesToSell)) {
            throw new Error('Insufficient shares');
          }

          const pricePerShare = new Decimal(lockedSlot.asset.currentPrice.toString());
          const totalProceeds = pricePerShare.times(sharesToSell);
          const newShares = currentShares.minus(sharesToSell);

          if (newShares.isZero()) {
            await tx.portfolioSlot.delete({
              where: { id: lockedSlot.id },
            });
          } else {
            await tx.portfolioSlot.update({
              where: { id: lockedSlot.id },
              data: {
                shares: newShares.toNumber(),
                currentPrice: pricePerShare.toNumber(),
              },
            });
          }

          const cashBalance = new Decimal(lockedPortfolio.cashBalance.toString());
          const newCashBalance = cashBalance.plus(totalProceeds);

          await tx.fantasyPortfolio.update({
            where: { id: lockedPortfolio.id },
            data: {
              cashBalance: newCashBalance.toNumber(),
            },
          });

          const transaction = await tx.fantasyPortfolioTransaction.create({
            data: {
              portfolioId: lockedPortfolio.id,
              assetId: validated.assetId,
              type: 'sell',
              shares: sharesToSell.toNumber(),
              pricePerShare: pricePerShare.toNumber(),
              totalAmount: totalProceeds.toNumber(),
              cashBefore: cashBalance.toNumber(),
              cashAfter: newCashBalance.toNumber(),
            },
          });

          return {
            transaction,
            newCashBalance: newCashBalance.toNumber(),
            remainingShares: newShares.toNumber(),
            portfolioId: lockedPortfolio.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    });

    await updatePortfolioTotalValue(result.portfolioId);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({ error: 'Trade conflict, please retry' });
    }
    if (error instanceof Error && error.message === 'Insufficient shares') {
      return res.status(400).json({ error: 'Insufficient shares' });
    }
    console.error('Error selling asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:groupId/portfolio/:userId - Get user's portfolio
router.get('/:groupId/portfolio/:userId', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const requesterUserId = await getCurrentUserId(req);

    if (requesterUserId !== userId) {
      const requesterMembership = await prisma.groupMembership.findUnique({
        where: {
          userId_groupId: {
            userId: requesterUserId,
            groupId,
          },
        },
      });

      if (!requesterMembership) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      include: {
        slots: {
          include: {
            asset: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Calculate total value
    let totalHoldingsValue = new Decimal(0);
    const formattedSlots = portfolio.slots.map((slot: any) => {
      const currentPrice = new Decimal(slot.asset.currentPrice.toString());
      const shares = new Decimal(slot.shares.toString());
      const averageCost = new Decimal(slot.averageCost.toString());

      const totalValue = currentPrice.times(shares);
      const totalCost = averageCost.times(shares);
      const gainLoss = totalValue.minus(totalCost);
      const gainLossPercent = totalCost.isZero() ? new Decimal(0) : gainLoss.dividedBy(totalCost).times(100);

      totalHoldingsValue = totalHoldingsValue.plus(totalValue);

      return {
        ...slot,
        asset: {
          ...slot.asset,
          currentPrice: parseFloat(slot.asset.currentPrice),
          previousClose: parseFloat(slot.asset.previousClose),
        },
        shares: parseFloat(slot.shares),
        averageCost: parseFloat(slot.averageCost),
        currentPrice: currentPrice.toNumber(),
        totalValue: totalValue.toNumber(),
        gainLoss: gainLoss.toNumber(),
        gainLossPercent: gainLossPercent.toNumber(),
      };
    });

    const cashBalance = new Decimal(portfolio.cashBalance.toString());
    const savingsAccount = new Decimal(portfolio.savingsAccount.toString());
    const bonds = new Decimal(portfolio.bonds.toString());
    const indexFunds = new Decimal(portfolio.indexFunds.toString());
    const totalValue = cashBalance.plus(totalHoldingsValue).plus(savingsAccount).plus(bonds).plus(indexFunds);

    const formatted = {
      ...portfolio,
      cashBalance: cashBalance.toNumber(),
      savingsAccount: savingsAccount.toNumber(),
      bonds: bonds.toNumber(),
      indexFunds: indexFunds.toNumber(),
      totalHoldingsValue: totalHoldingsValue.toNumber(),
      totalValue: totalValue.toNumber(),
      slots: formattedSlots,
      transactions: portfolio.transactions.map((t: any) => ({
        ...t,
        shares: parseFloat(t.shares),
        pricePerShare: parseFloat(t.pricePerShare),
        totalAmount: parseFloat(t.totalAmount),
        cashBefore: parseFloat(t.cashBefore),
        cashAfter: parseFloat(t.cashAfter),
      })),
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:groupId/assets - Get available assets for group
router.get('/:groupId/assets', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, minPrice, maxPrice, search } = req.query;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const settings = group.settings ? JSON.parse(group.settings) : {};
    const stockEnabledForGroup =
      !settings.enabledAssetClasses ||
      settings.enabledAssetClasses.length === 0 ||
      settings.enabledAssetClasses.includes('Stock');

    const where: any = {
      isActive: true,
      type: stockEnabledForGroup ? 'Stock' : { in: [] },
    };

    if (settings.minAssetPrice) {
      where.currentPrice = { gte: settings.minAssetPrice };
    }

    // Apply query filters
    if (type) {
      where.type = stockEnabledForGroup && type === 'Stock' ? 'Stock' : { in: [] };
    }

    if (minPrice) {
      where.currentPrice = { ...where.currentPrice, gte: parseFloat(minPrice as string) };
    }

    if (maxPrice) {
      where.currentPrice = { ...where.currentPrice, lte: parseFloat(maxPrice as string) };
    }

    if (search) {
      where.OR = [
        { ticker: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: [{ tier: 'asc' }, { currentPrice: 'desc' }],
      take: 100,
    });

    // Convert Decimal strings to numbers for frontend
    const formatted = assets.map((asset: any) => ({
      ...asset,
      currentPrice: parseFloat(asset.currentPrice),
      previousClose: parseFloat(asset.previousClose),
      changePercent: parseFloat(asset.previousClose) > 0
        ? ((parseFloat(asset.currentPrice) - parseFloat(asset.previousClose)) / parseFloat(asset.previousClose)) * 100
        : 0,
    }));

    res.json({ assets: formatted });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
