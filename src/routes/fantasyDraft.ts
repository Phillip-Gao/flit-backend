import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';

const router = Router();

// Validation schemas
const makeDraftPickSchema = z.object({
  userId: z.string(),
  assetId: z.string(),
});

// Helper function to check lesson gating
async function checkAssetLessonGating(userId: string, assetId: string): Promise<{ allowed: boolean; missingLessons?: string[] }> {
  const [user, asset] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { completedLessons: true },
    }),
    prisma.asset.findUnique({
      where: { id: assetId },
      select: { requiredLessons: true },
    }),
  ]);

  if (!user || !asset) {
    return { allowed: false };
  }

  if (asset.requiredLessons.length === 0) {
    return { allowed: true };
  }

  const missingLessons = asset.requiredLessons.filter(
    (lessonId) => !user.completedLessons.includes(lessonId)
  );

  return {
    allowed: missingLessons.length === 0,
    missingLessons: missingLessons.length > 0 ? missingLessons : undefined,
  };
}

// GET /api/fantasy-leagues/:id/draft - Get current draft state
router.get('/:groupId/draft', async (req, res) => {
  try {
    const { groupId } = req.params;

    const draftState = await prisma.draftState.findUnique({
      where: { groupId },
      include: {
        picks: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            asset: true,
          },
          orderBy: [{ round: 'asc' }, { pickNumber: 'asc' }],
        },
        group: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });

    if (!draftState) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Format picks with converted asset prices
    const formatted = {
      ...draftState,
      picks: draftState.picks.map((pick: any) => ({
        ...pick,
        asset: pick.asset ? {
          ...pick.asset,
          currentPrice: parseFloat(pick.asset.currentPrice),
          previousClose: parseFloat(pick.asset.previousClose),
        } : null,
      })),
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching draft state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:groupId/draft/pick - Make a draft pick
router.post('/:groupId/draft/pick', async (req, res) => {
  try {
    const { groupId } = req.params;
    const validated = makeDraftPickSchema.parse(req.body);

    const draftState = await prisma.draftState.findUnique({
      where: { groupId },
      include: {
        picks: true,
        group: {
          include: {
            memberships: {
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });

    if (!draftState) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draftState.status !== 'active') {
      return res.status(400).json({ error: 'Draft is not active' });
    }

    if (draftState.currentUserId !== validated.userId) {
      return res.status(403).json({ error: 'Not your turn to pick' });
    }

    // Check if asset is already drafted
    const assetAlreadyDrafted = draftState.picks.some(
      (pick) => pick.assetId === validated.assetId
    );

    if (assetAlreadyDrafted) {
      return res.status(400).json({ error: 'Asset already drafted' });
    }

    // Check lesson gating
    const lessonCheck = await checkAssetLessonGating(validated.userId, validated.assetId);
    if (!lessonCheck.allowed) {
      return res.status(403).json({
        error: 'Asset locked',
        code: 'LESSON_REQUIRED',
        missingLessons: lessonCheck.missingLessons,
      });
    }

    // Create the pick
    const pick = await prisma.draftPick.create({
      data: {
        draftStateId: draftState.id,
        round: draftState.currentRound,
        pickNumber: draftState.currentPickNumber,
        userId: validated.userId,
        assetId: validated.assetId,
      },
      include: {
        asset: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Calculate next pick using snake draft logic
    const totalMembers = draftState.group.memberships.length;
    const settings = JSON.parse(draftState.group.settings || '{}');
    const totalRounds = Math.ceil(settings.portfolioSize / totalMembers);

    let nextRound = draftState.currentRound;
    let nextPickNumber = draftState.currentPickNumber + 1;
    let nextUserIndex: number;

    // Snake draft logic
    if (draftState.currentRound % 2 === 1) {
      // Odd rounds go 1 -> n
      if (draftState.currentPickNumber >= totalMembers) {
        nextRound++;
        nextPickNumber = totalMembers;
      }
      nextUserIndex = nextPickNumber - 1;
    } else {
      // Even rounds go n -> 1
      if (draftState.currentPickNumber >= totalMembers) {
        nextRound++;
        nextPickNumber = 1;
      }
      nextUserIndex = totalMembers - nextPickNumber;
    }

    const nextUserId = draftState.group.memberships[nextUserIndex]?.userId;
    const isDraftComplete = nextRound > totalRounds;

    // Update draft state
    await prisma.draftState.update({
      where: { id: draftState.id },
      data: {
        currentRound: isDraftComplete ? nextRound : nextRound,
        currentPickNumber: isDraftComplete ? nextPickNumber : nextPickNumber,
        currentUserId: isDraftComplete ? null : nextUserId,
        status: isDraftComplete ? 'completed' : 'active',
        remainingTimeSeconds: isDraftComplete ? 0 : settings.draftTimePerPick || 60,
        timerStartedAt: isDraftComplete ? null : new Date(),
      },
    });

    // Create portfolio entries for completed draft
    if (isDraftComplete) {
      const allPicks = await prisma.draftPick.findMany({
        where: { draftStateId: draftState.id },
      });

      // Group picks by user
      const picksByUser = allPicks.reduce((acc: any, pick) => {
        if (!acc[pick.userId]) acc[pick.userId] = [];
        acc[pick.userId].push(pick);
        return acc;
      }, {});

      // Create portfolios
      for (const [userId, userPicks] of Object.entries(picksByUser)) {
        const portfolio = await prisma.fantasyPortfolio.create({
          data: {
            groupId,
            userId,
          },
        });

        // Create slots for each pick
        for (let i = 0; i < (userPicks as any).length; i++) {
          const draftPick = (userPicks as any)[i];
          const asset = await prisma.asset.findUnique({
            where: { id: draftPick.assetId },
          });

          await prisma.portfolioSlot.create({
            data: {
              portfolioId: portfolio.id,
              assetId: draftPick.assetId,
              shares: 1, // Each draft pick gives 1 share
              averageCost: asset?.currentPrice || 0,
              currentPrice: asset?.currentPrice || 0,
              status: i < settings.activeSlots ? 'ACTIVE' : 'BENCH',
            },
          });
        }
      }
    }

    res.status(201).json(pick);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error making draft pick:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:groupId/draft/assets - Get available assets for draft
router.get('/:groupId/draft/assets', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, minPrice, maxPrice, search } = req.query;

    const draftState = await prisma.draftState.findUnique({
      where: { groupId },
      include: {
        picks: true,
        group: true,
      },
    });

    if (!draftState) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const draftedAssetIds = draftState.picks.map((pick) => pick.assetId);
    const settings = JSON.parse(draftState.group.settings || '{}');

    const where: any = {
      id: { notIn: draftedAssetIds },
      isActive: true,
    };

    if (settings.enabledAssetClasses && settings.enabledAssetClasses.length > 0) {
      where.type = { in: settings.enabledAssetClasses };
    }

    if (type) {
      where.type = type as string;
    }

    if (settings.minAssetPrice) {
      where.currentPrice = { gte: settings.minAssetPrice };
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
    console.error('Error fetching draft assets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:groupId/draft/start - Start the draft
router.post('/:groupId/draft/start', async (req, res) => {
  try {
    const { groupId } = req.params;

    const draftState = await prisma.draftState.findUnique({
      where: { groupId },
      include: {
        group: {
          include: {
            memberships: {
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });

    if (!draftState) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draftState.status !== 'pending') {
      return res.status(400).json({ error: 'Draft already started or completed' });
    }

    const firstUserId = draftState.group.memberships[0]?.userId;
    const settings = JSON.parse(draftState.group.settings || '{}');

    const updated = await prisma.draftState.update({
      where: { id: draftState.id },
      data: {
        status: 'active',
        currentUserId: firstUserId,
        currentRound: 1,
        currentPickNumber: 1,
        remainingTimeSeconds: settings.draftTimePerPick || 60,
        timerStartedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error starting draft:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
