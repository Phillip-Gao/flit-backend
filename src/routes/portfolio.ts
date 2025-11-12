import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';

const router = Router();

// Validation schemas
const createHoldingSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  companyName: z.string().min(1),
  shares: z.number().positive(),
  averageCost: z.number().positive(),
});

const updateHoldingSchema = z.object({
  shares: z.number().positive().optional(),
  averageCost: z.number().positive().optional(),
  currentPrice: z.number().nonnegative().optional(),
});

const createTransactionSchema = z.object({
  type: z.enum(['buy', 'sell']),
  shares: z.number().positive(),
  price: z.number().positive(),
  fees: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

// GET /api/portfolio/:userId - Get user's portfolio
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const holdings = await prisma.portfolioHolding.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5 // Last 5 transactions per holding
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate portfolio summary
    const totalValue = holdings.reduce((sum: number, holding: any) => 
      sum + Number(holding.totalValue), 0);
    const totalGainLoss = holdings.reduce((sum: number, holding: any) => 
      sum + Number(holding.gainLoss), 0);

    res.json({
      holdings,
      summary: {
        totalValue,
        totalGainLoss,
        totalGainLossPercent: totalValue > 0 ? (totalGainLoss / (totalValue - totalGainLoss)) * 100 : 0,
        holdingsCount: holdings.length
      }
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/portfolio/:userId/holdings/:symbol - Get specific holding
router.get('/:userId/holdings/:symbol', async (req, res) => {
  try {
    const { userId, symbol } = req.params;

    const holding = await prisma.portfolioHolding.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase()
        }
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!holding) {
      return res.status(404).json({ error: 'Holding not found' });
    }

    res.json(holding);
  } catch (error) {
    console.error('Error fetching holding:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/portfolio/:userId/holdings - Add new holding
router.post('/:userId/holdings', async (req, res) => {
  try {
    const { userId } = req.params;
    const validatedData = createHoldingSchema.parse(req.body);

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate initial values
    const totalCost = Number(validatedData.shares) * Number(validatedData.averageCost);
    
    const holding = await prisma.portfolioHolding.create({
      data: {
        userId,
        ...validatedData,
        currentPrice: validatedData.averageCost, // Initial current price same as average cost
        totalValue: totalCost,
        gainLoss: 0,
        gainLossPercent: 0,
      },
    });

    // Create initial transaction
    await prisma.portfolioTransaction.create({
      data: {
        holdingId: holding.id,
        type: 'buy',
        shares: validatedData.shares,
        price: validatedData.averageCost,
        totalAmount: totalCost,
      }
    });

    res.status(201).json(holding);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating holding:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/portfolio/:userId/holdings/:symbol - Update holding
router.put('/:userId/holdings/:symbol', async (req, res) => {
  try {
    const { userId, symbol } = req.params;
    const validatedData = updateHoldingSchema.parse(req.body);

    const holding = await prisma.portfolioHolding.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase()
        }
      }
    });

    if (!holding) {
      return res.status(404).json({ error: 'Holding not found' });
    }

    // Calculate new values if current price is updated
    let updateData: any = { ...validatedData };
    if (validatedData.currentPrice !== undefined) {
      const shares = validatedData.shares || holding.shares;
      const averageCost = validatedData.averageCost || holding.averageCost;
      const currentPrice = validatedData.currentPrice;
      
      const totalValue = Number(shares) * Number(currentPrice);
      const totalCost = Number(shares) * Number(averageCost);
      const gainLoss = totalValue - totalCost;
      const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

      updateData = {
        ...updateData,
        totalValue,
        gainLoss,
        gainLossPercent,
      };
    }

    const updatedHolding = await prisma.portfolioHolding.update({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase()
        }
      },
      data: updateData,
    });

    res.json(updatedHolding);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error updating holding:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/portfolio/:userId/holdings/:symbol - Remove holding
router.delete('/:userId/holdings/:symbol', async (req, res) => {
  try {
    const { userId, symbol } = req.params;

    await prisma.portfolioHolding.update({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase()
        }
      },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting holding:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/portfolio/:userId/holdings/:symbol/transactions - Add transaction
router.post('/:userId/holdings/:symbol/transactions', async (req, res) => {
  try {
    const { userId, symbol } = req.params;
    const validatedData = createTransactionSchema.parse(req.body);

    const holding = await prisma.portfolioHolding.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase()
        }
      }
    });

    if (!holding) {
      return res.status(404).json({ error: 'Holding not found' });
    }

    const totalAmount = Number(validatedData.shares) * Number(validatedData.price) + Number(validatedData.fees);

    // Create transaction
    const transaction = await prisma.portfolioTransaction.create({
      data: {
        holdingId: holding.id,
        ...validatedData,
        totalAmount,
      }
    });

    // Update holding based on transaction
    let newShares = Number(holding.shares);
    let newAverageCost = Number(holding.averageCost);

    if (validatedData.type === 'buy') {
      const totalOldValue = Number(holding.shares) * Number(holding.averageCost);
      const totalNewValue = Number(validatedData.shares) * Number(validatedData.price);
      newShares += Number(validatedData.shares);
      newAverageCost = (totalOldValue + totalNewValue) / newShares;
    } else { // sell
      newShares -= Number(validatedData.shares);
      if (newShares < 0) {
        return res.status(400).json({ error: 'Cannot sell more shares than owned' });
      }
    }

    // Update holding with new values
    const totalValue = newShares * Number(holding.currentPrice);
    const totalCost = newShares * newAverageCost;
    const gainLoss = totalValue - totalCost;
    const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

    await prisma.portfolioHolding.update({
      where: { id: holding.id },
      data: {
        shares: newShares,
        averageCost: newAverageCost,
        totalValue,
        gainLoss,
        gainLossPercent,
        isActive: newShares > 0, // Mark as inactive if no shares left
      }
    });

    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;