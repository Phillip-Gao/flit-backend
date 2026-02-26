import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { finnhubService } from '../services/finnhub';

const router = Router();

/**
 * GET /api/watchlist
 * Get user's watchlist with current stock prices from Asset table
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Fetch watchlist items from database
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (watchlistItems.length === 0) {
      return res.json([]);
    }

    // Fetch current prices from Asset table (same source as portfolio values)
    const symbols = watchlistItems.map((item: any) => item.symbol);
    const assets = await prisma.asset.findMany({
      where: {
        ticker: { in: symbols }
      },
      select: {
        ticker: true,
        name: true,
        currentPrice: true,
        previousClose: true,
      }
    });

    // Create a map for quick lookup
    const assetMap = new Map(assets.map(asset => [asset.ticker, asset]));

    // Combine watchlist data with prices from Asset table
    const watchlistWithPrices = watchlistItems.map((item: any) => {
      const asset = assetMap.get(item.symbol);
      const currentPrice = asset?.currentPrice ? parseFloat(asset.currentPrice.toString()) : 0;
      const previousClose = asset?.previousClose ? parseFloat(asset.previousClose.toString()) : 0;
      const change = currentPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

      return {
        id: item.id,
        symbol: item.symbol,
        name: asset?.name || item.symbol,
        currentPrice: currentPrice,
        change: change,
        changePercent: changePercent,
        addedAt: item.createdAt,
      };
    });

    res.json(watchlistWithPrices);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

/**
 * POST /api/watchlist
 * Add a stock to user's watchlist
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, symbol } = req.body;

    if (!userId || !symbol) {
      return res.status(400).json({ error: 'User ID and symbol are required' });
    }

    // Check if already in watchlist
    const existing = await prisma.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase(),
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Stock already in watchlist' });
    }

    // Verify stock exists by fetching quote
    const quote = await finnhubService.getQuote(symbol.toUpperCase());
    if (!quote) {
      return res.status(404).json({ error: 'Stock symbol not found' });
    }

    // Add to watchlist
    const watchlistItem = await prisma.watchlistItem.create({
      data: {
        userId,
        symbol: symbol.toUpperCase(),
      },
    });

    // Fetch company profile for response
    const profile = await finnhubService.getCompanyProfile(symbol.toUpperCase());

    res.status(201).json({
      id: watchlistItem.id,
      symbol: watchlistItem.symbol,
      name: profile?.name || watchlistItem.symbol,
      currentPrice: quote.currentPrice,
      change: quote.change,
      changePercent: quote.changePercent,
      addedAt: watchlistItem.createdAt,
    });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

/**
 * DELETE /api/watchlist/:id
 * Remove a stock from user's watchlist
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Verify ownership before deleting
    const item = await prisma.watchlistItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    if (item.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this item' });
    }

    await prisma.watchlistItem.delete({
      where: { id },
    });

    res.json({ message: 'Stock removed from watchlist' });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

/**
 * GET /api/watchlist/search
 * Search for stocks to add to watchlist
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await finnhubService.searchSymbol(query);
    res.json(results);
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

/**
 * GET /api/watchlist/news/:symbol
 * Get news articles for a specific stock
 */
router.get('/news/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { from, to } = req.query;

    const news = await finnhubService.getCompanyNews(
      symbol.toUpperCase(),
      from as string | undefined,
      to as string | undefined
    );

    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

export default router;
