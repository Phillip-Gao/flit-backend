import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';
import Decimal from 'decimal.js';

const router = Router();

// Validation schemas
const buyAssetSchema = z.object({
  userId: z.string(),
  assetId: z.string(),
  shares: z.number().positive(),
});

const sellAssetSchema = z.object({
  userId: z.string(),
  assetId: z.string(),
  shares: z.number().positive(),
});

// POST /api/fantasy-leagues/:leagueId/buy - Buy an asset
router.post('/:leagueId/buy', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const validated = buyAssetSchema.parse(req.body);

    // Get user's portfolio
    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: validated.userId,
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

    // Check league settings
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const settings = league.settings ? JSON.parse(league.settings) : {};

    // Check if trading is enabled
    if (settings.tradingEnabled === false) {
      return res.status(403).json({ error: 'Trading is disabled for this league' });
    }

    // Check if asset class is allowed
    if (settings.enabledAssetClasses && settings.enabledAssetClasses.length > 0) {
      if (!settings.enabledAssetClasses.includes(asset.type)) {
        return res.status(403).json({
          error: `Asset class ${asset.type} is not enabled for this league`
        });
      }
    }

    // Check minimum asset price
    if (settings.minAssetPrice && parseFloat(asset.currentPrice.toString()) < settings.minAssetPrice) {
      return res.status(403).json({
        error: `Asset price is below league minimum of $${settings.minAssetPrice}`
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
      where: { id: validated.userId },
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

    // Update or create portfolio slot
    const existingSlot = await prisma.portfolioSlot.findUnique({
      where: {
        portfolioId_assetId: {
          portfolioId: portfolio.id,
          assetId: validated.assetId,
        },
      },
    });

    let newAverageCost: Decimal;
    let newShares: Decimal;

    if (existingSlot) {
      // Calculate new average cost
      const currentShares = new Decimal(existingSlot.shares.toString());
      const currentAverageCost = new Decimal(existingSlot.averageCost.toString());
      const currentTotalCost = currentShares.times(currentAverageCost);

      newShares = currentShares.plus(sharesToBuy);
      const newTotalCost = currentTotalCost.plus(totalCost);
      newAverageCost = newTotalCost.dividedBy(newShares);

      await prisma.portfolioSlot.update({
        where: { id: existingSlot.id },
        data: {
          shares: newShares.toNumber(),
          averageCost: newAverageCost.toNumber(),
          currentPrice: pricePerShare.toNumber(),
        },
      });
    } else {
      // Create new slot
      newShares = sharesToBuy;
      newAverageCost = pricePerShare;

      await prisma.portfolioSlot.create({
        data: {
          portfolioId: portfolio.id,
          assetId: validated.assetId,
          shares: newShares.toNumber(),
          averageCost: newAverageCost.toNumber(),
          currentPrice: pricePerShare.toNumber(),
        },
      });
    }

    // Update portfolio cash balance
    const newCashBalance = cashBalance.minus(totalCost);
    await prisma.fantasyPortfolio.update({
      where: { id: portfolio.id },
      data: {
        cashBalance: newCashBalance.toNumber(),
      },
    });

    // Create transaction record
    const transaction = await prisma.fantasyPortfolioTransaction.create({
      data: {
        portfolioId: portfolio.id,
        assetId: validated.assetId,
        type: 'buy',
        shares: sharesToBuy.toNumber(),
        pricePerShare: pricePerShare.toNumber(),
        totalAmount: totalCost.toNumber(),
        cashBefore: cashBalance.toNumber(),
        cashAfter: newCashBalance.toNumber(),
      },
    });

    res.status(201).json({
      transaction,
      newCashBalance: newCashBalance.toNumber(),
      newShares: newShares.toNumber(),
      averageCost: newAverageCost.toNumber(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error buying asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:leagueId/sell - Sell an asset
router.post('/:leagueId/sell', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const validated = sellAssetSchema.parse(req.body);

    // Get user's portfolio
    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: validated.userId,
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check league settings
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const settings = league.settings ? JSON.parse(league.settings) : {};

    // Check if trading is enabled
    if (settings.tradingEnabled === false) {
      return res.status(403).json({ error: 'Trading is disabled for this league' });
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

    // Update portfolio slot
    const newShares = currentShares.minus(sharesToSell);

    if (newShares.isZero()) {
      // Delete slot if no shares remain
      await prisma.portfolioSlot.delete({
        where: { id: slot.id },
      });
    } else {
      // Update shares
      await prisma.portfolioSlot.update({
        where: { id: slot.id },
        data: {
          shares: newShares.toNumber(),
          currentPrice: pricePerShare.toNumber(),
        },
      });
    }

    // Update portfolio cash balance
    const cashBalance = new Decimal(portfolio.cashBalance.toString());
    const newCashBalance = cashBalance.plus(totalProceeds);

    await prisma.fantasyPortfolio.update({
      where: { id: portfolio.id },
      data: {
        cashBalance: newCashBalance.toNumber(),
      },
    });

    // Create transaction record
    const transaction = await prisma.fantasyPortfolioTransaction.create({
      data: {
        portfolioId: portfolio.id,
        assetId: validated.assetId,
        type: 'sell',
        shares: sharesToSell.toNumber(),
        pricePerShare: pricePerShare.toNumber(),
        totalAmount: totalProceeds.toNumber(),
        cashBefore: cashBalance.toNumber(),
        cashAfter: newCashBalance.toNumber(),
      },
    });

    res.status(201).json({
      transaction,
      newCashBalance: newCashBalance.toNumber(),
      remainingShares: newShares.toNumber(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error selling asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:leagueId/portfolio/:userId - Get user's portfolio
router.get('/:leagueId/portfolio/:userId', async (req, res) => {
  try {
    const { leagueId, userId } = req.params;

    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
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
    const totalValue = cashBalance.plus(totalHoldingsValue);

    const formatted = {
      ...portfolio,
      cashBalance: cashBalance.toNumber(),
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

// GET /api/fantasy-leagues/:leagueId/assets - Get available assets for league
router.get('/:leagueId/assets', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { type, minPrice, maxPrice, search } = req.query;

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const settings = league.settings ? JSON.parse(league.settings) : {};

    const where: any = {
      isActive: true,
    };

    // Apply league settings filters
    if (settings.enabledAssetClasses && settings.enabledAssetClasses.length > 0) {
      where.type = { in: settings.enabledAssetClasses };
    }

    if (settings.minAssetPrice) {
      where.currentPrice = { gte: settings.minAssetPrice };
    }

    // Apply query filters
    if (type) {
      where.type = type as string;
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
