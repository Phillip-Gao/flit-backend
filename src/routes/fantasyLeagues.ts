import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';
import fantasyDraftRoutes from './fantasyDraft';

const router = Router();

// Validation schemas
const createLeagueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  adminUserId: z.string(),
  settings: z.object({
    leagueSize: z.number().int().min(2).max(20),
    startingBalance: z.number().min(1000).max(1000000).default(10000),
    competitionPeriod: z.enum(['1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year']),
    startDate: z.string().datetime(),
    scoringMethod: z.enum(['Total Return %', 'Absolute Gain $']),
    enabledAssetClasses: z.array(z.enum(['Stock', 'ETF', 'Commodity', 'REIT'])),
    minAssetPrice: z.number().min(0).default(1),
    allowShortSelling: z.boolean().default(false),
    tradingEnabled: z.boolean().default(true),
  }),
});

// GET /api/fantasy-leagues - List leagues for current user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const leagues = await prisma.league.findMany({
      where: {
        OR: [
          { adminUserId: userId as string },
          { memberships: { some: { userId: userId as string } } },
        ],
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        draftState: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = leagues.map((league: any) => ({
      ...league,
      settings: league.settings ? JSON.parse(league.settings) : null,
      criteria: league.criteria ? JSON.parse(league.criteria) : null,
      memberCount: league._count.memberships,
      members: league.memberships.map((m: any) => m.user),
      status: league.draftState?.status === 'completed' ? 'active' :
              league.draftState?.status === 'active' ? 'drafting' :
              'pre-draft',
      currentWeek: 0, // TODO: Calculate based on league start date and current date
    }));

    res.json({ leagues: formatted });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:id - Get detailed league info
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { score: 'desc' },
        },
        draftState: {
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
          },
        },
        matchups: {
          orderBy: { week: 'desc' },
          take: 10,
        },
      },
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const formatted = {
      ...league,
      settings: league.settings ? JSON.parse(league.settings) : null,
      criteria: league.criteria ? JSON.parse(league.criteria) : null,
      members: league.memberships.map((m: any) => m.user),
      status: league.draftState?.status === 'completed' ? 'active' :
              league.draftState?.status === 'active' ? 'drafting' :
              'pre-draft',
      currentWeek: 0, // TODO: Calculate based on league start date and current date
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching league:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues - Create a new league
router.post('/', async (req, res) => {
  try {
    const validated = createLeagueSchema.parse(req.body);

    const league = await prisma.league.create({
      data: {
        name: validated.name,
        description: validated.description,
        adminUserId: validated.adminUserId,
        type: 'custom',
        maxMembers: validated.settings.leagueSize,
        settings: JSON.stringify(validated.settings),
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Auto-add admin as first member
    await prisma.leagueMembership.create({
      data: {
        leagueId: league.id,
        userId: validated.adminUserId,
      },
    });

    // Create portfolio for admin with starting balance
    await prisma.fantasyPortfolio.create({
      data: {
        leagueId: league.id,
        userId: validated.adminUserId,
        cashBalance: validated.settings.startingBalance,
      },
    });

    const formatted = {
      ...league,
      settings: JSON.parse(league.settings || '{}'),
    };

    res.status(201).json(formatted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating league:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:id/join - Join a league
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    if (league._count.memberships >= league.maxMembers) {
      return res.status(400).json({ error: 'League is full' });
    }

    // Check if user is already a member
    const existingMembership = await prisma.leagueMembership.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: id,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'Already a member of this league' });
    }

    // Create membership
    const membership = await prisma.leagueMembership.create({
      data: {
        leagueId: id,
        userId,
      },
    });

    // Get league settings to determine starting balance
    const settings = league.settings ? JSON.parse(league.settings) : {};
    const startingBalance = settings.startingBalance || 10000;

    // Create portfolio with starting balance
    await prisma.fantasyPortfolio.create({
      data: {
        leagueId: id,
        userId,
        cashBalance: startingBalance,
      },
    });

    res.status(201).json(membership);
  } catch (error) {
    console.error('Error joining league:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount draft routes under fantasy-leagues
router.use('/', fantasyDraftRoutes);

export default router;
