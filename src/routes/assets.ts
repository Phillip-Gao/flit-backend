/**
 * Asset management routes
 */

import { Router } from 'express';
import prisma from '../services/prisma';
import { stockPriceUpdater } from '../services/stockPriceUpdater';

const router = Router();

// GET /api/assets - Get all assets
router.get('/', async (req, res) => {
  try {
    const { type, isActive, search } = req.query;

    const where: any = {};

    if (type) {
      where.type = type as string;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { ticker: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: [{ tier: 'asc' }, { ticker: 'asc' }],
    });

    // Convert Decimal to numbers
    const formatted = assets.map(asset => ({
      ...asset,
      currentPrice: parseFloat(asset.currentPrice.toString()),
      previousClose: parseFloat(asset.previousClose.toString()),
      marketCap: asset.marketCap ? parseFloat(asset.marketCap.toString()) : null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assets/:ticker - Get asset by ticker
router.get('/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const formatted = {
      ...asset,
      currentPrice: parseFloat(asset.currentPrice.toString()),
      previousClose: parseFloat(asset.previousClose.toString()),
      marketCap: asset.marketCap ? parseFloat(asset.marketCap.toString()) : null,
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assets/update-prices - Manually trigger price update
router.post('/update-prices', async (req, res) => {
  try {
    const { force } = req.query; // Optional query param to force update
    const result = await stockPriceUpdater.updateAllStockPrices(force === 'true');
    res.json(result);
  } catch (error) {
    console.error('Error updating prices:', error);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

// POST /api/assets/:ticker/update-price - Update single stock price
router.post('/:ticker/update-price', async (req, res) => {
  try {
    const { ticker } = req.params;
    await stockPriceUpdater.updateStockPrice(ticker.toUpperCase());
    res.json({ message: `Price updated for ${ticker}` });
  } catch (error) {
    console.error(`Error updating ${req.params.ticker}:`, error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

export default router;
