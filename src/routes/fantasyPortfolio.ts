/**
 * Fantasy Portfolio Trading Routes
 * Handles buy/sell operations for fantasy portfolios
 */

import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';
import { getCurrentUser, getCurrentUserId } from '../services/currentUser';
import { Decimal } from '@prisma/client/runtime/library';
import { recalculateUserPortfolios } from '../services/portfolioCalculator';

const router = Router();

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

/**
 * GET /api/fantasy-portfolio - Get current user's portfolios
 * Automatically recalculates portfolio values to ensure they're up-to-date
 */
router.get('/', async (req, res) => {
  try {
    const user = await getCurrentUser();

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
    const userId = await getCurrentUserId();

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

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/fantasy-portfolio/trade - Execute a buy or sell trade
 */
router.post('/trade', async (req, res) => {
  try {
    const validated = tradeSchema.parse(req.body);
    const { groupId, ticker, shares, tradeType } = validated;
    const userId = await getCurrentUserId();

    // Get the asset
    const asset = await prisma.asset.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get the portfolio
    const portfolio = await prisma.fantasyPortfolio.findUnique({
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

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const existingSlot = portfolio.slots[0];
    const currentPrice = Number(asset.currentPrice);
    const tradeAmount = currentPrice * shares;

    if (tradeType === 'buy') {
      // Check if user has enough cash
      const cashBalance = Number(portfolio.cashBalance);
      if (cashBalance < tradeAmount) {
        return res.status(400).json({ error: 'Insufficient cash balance' });
      }

      if (existingSlot) {
        // Update existing slot
        const currentShares = Number(existingSlot.shares);
        const currentAvgCost = Number(existingSlot.averageCost);
        const newShares = currentShares + shares;
        const newAvgCost = (currentShares * currentAvgCost + tradeAmount) / newShares;

        const updatedSlot = await prisma.portfolioSlot.update({
          where: { id: existingSlot.id },
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

        // Update portfolio cash balance and total value
        const newCashBalance = cashBalance - tradeAmount;
        const newTotalValue = newCashBalance + newShares * currentPrice;

        await prisma.fantasyPortfolio.update({
          where: { id: portfolio.id },
          data: {
            cashBalance: new Decimal(newCashBalance),
            totalValue: new Decimal(newTotalValue),
          },
        });

        // Create transaction record
        await prisma.fantasyPortfolioTransaction.create({
          data: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            type: 'buy',
            shares: new Decimal(shares),
            pricePerShare: asset.currentPrice,
            totalAmount: new Decimal(tradeAmount),
            cashBefore: portfolio.cashBalance,
            cashAfter: new Decimal(newCashBalance),
          },
        });

        return res.json({
          success: true,
          slot: updatedSlot,
          portfolio: {
            cashBalance: newCashBalance,
            totalValue: newTotalValue,
          },
        });
      } else {
        // Create new slot
        const newSlot = await prisma.portfolioSlot.create({
          data: {
            portfolioId: portfolio.id,
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

        // Update portfolio cash balance and total value
        const newCashBalance = cashBalance - tradeAmount;
        const newTotalValue = newCashBalance + shares * currentPrice;

        await prisma.fantasyPortfolio.update({
          where: { id: portfolio.id },
          data: {
            cashBalance: new Decimal(newCashBalance),
            totalValue: new Decimal(newTotalValue),
          },
        });

        // Create transaction record
        await prisma.fantasyPortfolioTransaction.create({
          data: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            type: 'buy',
            shares: new Decimal(shares),
            pricePerShare: asset.currentPrice,
            totalAmount: new Decimal(tradeAmount),
            cashBefore: portfolio.cashBalance,
            cashAfter: new Decimal(newCashBalance),
          },
        });

        return res.json({
          success: true,
          slot: newSlot,
          portfolio: {
            cashBalance: newCashBalance,
            totalValue: newTotalValue,
          },
        });
      }
    } else if (tradeType === 'sell') {
      // Sell logic
      if (!existingSlot) {
        return res.status(400).json({ error: 'No holdings to sell' });
      }

      const currentShares = Number(existingSlot.shares);
      if (currentShares < shares) {
        return res.status(400).json({ error: 'Insufficient shares to sell' });
      }

      const newShares = currentShares - shares;
      const cashBalance = Number(portfolio.cashBalance);

      if (newShares === 0) {
        // Delete slot if selling all shares
        await prisma.portfolioSlot.delete({
          where: { id: existingSlot.id },
        });

        // Update portfolio
        const newCashBalance = cashBalance + tradeAmount;
        const newTotalValue = newCashBalance; // No more holdings for this asset

        await prisma.fantasyPortfolio.update({
          where: { id: portfolio.id },
          data: {
            cashBalance: new Decimal(newCashBalance),
            totalValue: new Decimal(newTotalValue),
          },
        });

        // Create transaction record
        await prisma.fantasyPortfolioTransaction.create({
          data: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            type: 'sell',
            shares: new Decimal(shares),
            pricePerShare: asset.currentPrice,
            totalAmount: new Decimal(tradeAmount),
            cashBefore: portfolio.cashBalance,
            cashAfter: new Decimal(newCashBalance),
          },
        });

        return res.json({
          success: true,
          slot: null,
          portfolio: {
            cashBalance: newCashBalance,
            totalValue: newTotalValue,
          },
        });
      } else {
        // Update slot with reduced shares
        const avgCost = Number(existingSlot.averageCost);
        const updatedSlot = await prisma.portfolioSlot.update({
          where: { id: existingSlot.id },
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

        // Update portfolio
        const newCashBalance = cashBalance + tradeAmount;
        const newTotalValue = newCashBalance + newShares * currentPrice;

        await prisma.fantasyPortfolio.update({
          where: { id: portfolio.id },
          data: {
            cashBalance: new Decimal(newCashBalance),
            totalValue: new Decimal(newTotalValue),
          },
        });

        // Create transaction record
        await prisma.fantasyPortfolioTransaction.create({
          data: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            type: 'sell',
            shares: new Decimal(shares),
            pricePerShare: asset.currentPrice,
            totalAmount: new Decimal(tradeAmount),
            cashBefore: portfolio.cashBalance,
            cashAfter: new Decimal(newCashBalance),
          },
        });

        return res.json({
          success: true,
          slot: updatedSlot,
          portfolio: {
            cashBalance: newCashBalance,
            totalValue: newTotalValue,
          },
        });
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
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
    const userId = await getCurrentUserId();
    
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
    const userId = await getCurrentUserId();

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

    // Map asset type to database field name
    const fieldMap: Record<string, keyof typeof portfolio> = {
      savings: 'savingsAccount',
      bonds: 'bonds',
      indexFunds: 'indexFunds',
    };

    const fieldName = fieldMap[assetType];

    const cashBalance = Number(portfolio.cashBalance);
    const currentAllocation = Number(portfolio[fieldName] || 0);

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

    await prisma.fantasyPortfolio.update({
      where: { id: portfolio.id },
      data: {
        cashBalance: new Decimal(newCashBalance),
        [fieldName]: new Decimal(newAllocation),
      },
    });

    res.json({
      success: true,
      portfolio: {
        cashBalance: newCashBalance,
        [assetType]: newAllocation,
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

export default router;
