import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';

const router = Router();

// Validation schemas
const updateLineupSchema = z.object({
  activeSlotIds: z.array(z.string()),
  benchSlotIds: z.array(z.string()),
});

const createTradeSchema = z.object({
  creatorId: z.string(),
  recipientId: z.string(),
  offeredAssetIds: z.array(z.string()),
  requestedAssetIds: z.array(z.string()),
});

const createWaiverClaimSchema = z.object({
  userId: z.string(),
  assetId: z.string(),
  dropAssetId: z.string().optional(),
});

// ============ PORTFOLIO ENDPOINTS ============

// GET /api/fantasy-leagues/:leagueId/portfolio - Get user's portfolio for a league
router.get('/:leagueId/portfolio', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: userId as string,
        },
      },
      include: {
        slots: {
          include: {
            asset: true,
          },
          orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Convert Decimal strings to numbers in asset prices
    const formatted = {
      ...portfolio,
      slots: portfolio.slots.map((slot: any) => ({
        ...slot,
        asset: slot.asset ? {
          ...slot.asset,
          currentPrice: parseFloat(slot.asset.currentPrice),
          previousClose: parseFloat(slot.asset.previousClose),
        } : null,
        purchasePrice: parseFloat(slot.purchasePrice),
      })),
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/fantasy-portfolios/:id/lineup - Update active/bench slots
router.put('/portfolios/:id/lineup', async (req, res) => {
  try {
    const { id } = req.params;
    const validated = updateLineupSchema.parse(req.body);

    const portfolio = await prisma.fantasyPortfolio.findUnique({
      where: { id },
      include: {
        slots: true,
        league: true,
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const settings = JSON.parse(portfolio.league.settings || '{}');
    const allSlotIds = [...validated.activeSlotIds, ...validated.benchSlotIds];

    // Validate slot counts
    if (validated.activeSlotIds.length !== settings.activeSlots) {
      return res.status(400).json({
        error: `Must have exactly ${settings.activeSlots} active slots`,
      });
    }

    if (validated.benchSlotIds.length !== settings.benchSlots) {
      return res.status(400).json({
        error: `Must have exactly ${settings.benchSlots} bench slots`,
      });
    }

    // Validate all slots belong to this portfolio
    const portfolioSlotIds = portfolio.slots.map((slot) => slot.id);
    const invalidSlots = allSlotIds.filter((id) => !portfolioSlotIds.includes(id));

    if (invalidSlots.length > 0) {
      return res.status(400).json({ error: 'Invalid slot IDs provided' });
    }

    // Update slots
    await Promise.all([
      ...validated.activeSlotIds.map((slotId) =>
        prisma.portfolioSlot.update({
          where: { id: slotId },
          data: { status: 'ACTIVE' },
        })
      ),
      ...validated.benchSlotIds.map((slotId) =>
        prisma.portfolioSlot.update({
          where: { id: slotId },
          data: { status: 'BENCH' },
        })
      ),
    ]);

    const updated = await prisma.fantasyPortfolio.findUnique({
      where: { id },
      include: {
        slots: {
          include: { asset: true },
          orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    // Convert Decimal strings to numbers in asset prices
    const formatted = updated ? {
      ...updated,
      slots: updated.slots.map((slot: any) => ({
        ...slot,
        asset: slot.asset ? {
          ...slot.asset,
          currentPrice: parseFloat(slot.asset.currentPrice),
          previousClose: parseFloat(slot.asset.previousClose),
        } : null,
        purchasePrice: parseFloat(slot.purchasePrice),
      })),
    } : null;

    res.json(formatted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error updating lineup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ MATCHUP ENDPOINTS ============

// GET /api/fantasy-leagues/:leagueId/matchup/current - Get current week's matchup
router.get('/:leagueId/matchup/current', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Find the most recent active or pending matchup for this user
    const matchup = await prisma.matchup.findFirst({
      where: {
        leagueId,
        OR: [{ user1Id: userId as string }, { user2Id: userId as string }],
        status: { in: ['pending', 'active'] },
      },
      orderBy: { week: 'desc' },
    });

    if (!matchup) {
      return res.status(404).json({ error: 'No active matchup found' });
    }

    res.json(matchup);
  } catch (error) {
    console.error('Error fetching current matchup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:leagueId/matchup/week/:week - Get specific week's matchup
router.get('/:leagueId/matchup/week/:week', async (req, res) => {
  try {
    const { leagueId, week } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const matchup = await prisma.matchup.findFirst({
      where: {
        leagueId,
        week: parseInt(week),
        OR: [{ user1Id: userId as string }, { user2Id: userId as string }],
      },
    });

    if (!matchup) {
      return res.status(404).json({ error: 'Matchup not found' });
    }

    res.json(matchup);
  } catch (error) {
    console.error('Error fetching matchup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ TRADE ENDPOINTS ============

// GET /api/fantasy-leagues/:leagueId/trades - List active trades
router.get('/:leagueId/trades', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { userId } = req.query;

    const where: any = { leagueId };

    if (userId) {
      where.OR = [{ creatorId: userId as string }, { recipientId: userId as string }];
    }

    const trades = await prisma.trade.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
        recipient: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ trades });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:leagueId/trades - Propose a trade
router.post('/:leagueId/trades', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const validated = createTradeSchema.parse(req.body);

    const trade = await prisma.trade.create({
      data: {
        leagueId,
        creatorId: validated.creatorId,
        recipientId: validated.recipientId,
        offeredAssetIds: validated.offeredAssetIds,
        requestedAssetIds: validated.requestedAssetIds,
        status: 'pending',
      },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        recipient: {
          select: { id: true, username: true },
        },
      },
    });

    res.status(201).json(trade);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-trades/:id/accept - Accept a trade proposal
router.post('/trades/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;

    const trade = await prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Trade is not pending' });
    }

    const updated = await prisma.trade.update({
      where: { id },
      data: {
        status: 'accepted',
        respondedAt: new Date(),
      },
    });

    // TODO: Implement actual asset swap logic here

    res.json(updated);
  } catch (error) {
    console.error('Error accepting trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-trades/:id/reject - Reject a trade proposal
router.post('/trades/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await prisma.trade.update({
      where: { id },
      data: {
        status: 'rejected',
        respondedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error rejecting trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-trades/:id/cancel - Cancel a pending trade
router.post('/trades/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await prisma.trade.update({
      where: { id },
      data: {
        status: 'cancelled',
        respondedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error cancelling trade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ WAIVER ENDPOINTS ============

// POST /api/fantasy-leagues/:leagueId/waivers - Submit a waiver claim
router.post('/:leagueId/waivers', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const validated = createWaiverClaimSchema.parse(req.body);

    // Get current waiver priority
    const existingClaims = await prisma.waiverClaim.findMany({
      where: {
        leagueId,
        status: 'pending',
      },
      select: { priority: true },
    });

    const maxPriority = existingClaims.length > 0 
      ? Math.max(...existingClaims.map((c) => c.priority))
      : 0;

    const claim = await prisma.waiverClaim.create({
      data: {
        leagueId,
        userId: validated.userId,
        assetId: validated.assetId,
        dropAssetId: validated.dropAssetId,
        priority: maxPriority + 1,
        status: 'pending',
      },
    });

    res.status(201).json(claim);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating waiver claim:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ASSET/MARKET ENDPOINTS ============

// GET /api/fantasy-assets/:id - Get detailed asset info
router.get('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Convert Decimal strings to numbers
    const formatted = {
      ...asset,
      currentPrice: parseFloat(asset.currentPrice as any),
      previousClose: parseFloat(asset.previousClose as any),
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:leagueId/market/assets - Search available assets
router.get('/:leagueId/market/assets', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { type, minPrice, maxPrice, search } = req.query;

    // Get all owned assets in this league
    const portfolios = await prisma.fantasyPortfolio.findMany({
      where: { leagueId },
      include: {
        slots: {
          select: { assetId: true },
        },
      },
    });

    const ownedAssetIds = portfolios.flatMap((p) => p.slots.map((s) => s.assetId));

    const where: any = {
      id: { notIn: ownedAssetIds },
      isActive: true,
    };

    if (type) {
      where.type = type as string;
    }

    if (minPrice) {
      where.currentPrice = { gte: parseFloat(minPrice as string) };
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

    // Convert Decimal strings to numbers
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
    console.error('Error fetching market assets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ NOTIFICATION ENDPOINTS ============

// GET /api/fantasy-notifications - Get user notifications
router.get('/notifications', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: userId as string },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-notifications/:id/read - Mark notification as read
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
