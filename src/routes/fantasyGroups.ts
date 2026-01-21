import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';

// Helper function to generate a unique 6-character alphanumeric join code
const generateJoinCode = (): string => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded similar chars like 0/O, 1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// Helper function to calculate group status based on start date and competition period
const calculateGroupStatus = (settings: any): 'pending' | 'active' | 'completed' => {
  if (!settings || !settings.startDate || !settings.competitionPeriod) {
    return 'pending';
  }

  const now = new Date();
  const startDate = new Date(settings.startDate);
  const endDate = new Date(startDate);

  // Calculate end date based on competition period
  switch (settings.competitionPeriod) {
    case '1_week': endDate.setDate(endDate.getDate() + 7); break;
    case '2_weeks': endDate.setDate(endDate.getDate() + 14); break;
    case '1_month': endDate.setMonth(endDate.getMonth() + 1); break;
    case '3_months': endDate.setMonth(endDate.getMonth() + 3); break;
    case '6_months': endDate.setMonth(endDate.getMonth() + 6); break;
    case '1_year': endDate.setFullYear(endDate.getFullYear() + 1); break;
  }

  if (now >= endDate) {
    return 'completed';
  } else if (now >= startDate) {
    return 'active';
  } else {
    return 'pending';
  }
};

import fantasyDraftRoutes from './fantasyDraft';

const router = Router();

// Validation schemas
const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  adminUserId: z.string(),
  settings: z.object({
    groupSize: z.number().int().min(2).max(20),
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

// GET /api/fantasy-leagues - List groups for current user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const groups = await prisma.group.findMany({
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

    const formatted = groups.map((g: any) => {
      const settings = g.settings ? JSON.parse(g.settings) : null;
      return {
        ...g,
        settings,
        criteria: g.criteria ? JSON.parse(g.criteria) : null,
        memberCount: g._count.memberships,
        members: g.memberships.map((m: any) => m.user),
        status: calculateGroupStatus(settings),
        currentWeek: 0, // TODO: Calculate based on group start date and current date
      };
    });

    res.json({ groups: formatted });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fantasy-leagues/:id - Get detailed group info
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({
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

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const settings = group.settings ? JSON.parse(group.settings) : null;
    const formatted = {
      ...group,
      settings,
      criteria: group.criteria ? JSON.parse(group.criteria) : null,
      members: group.memberships.map((m: any) => m.user),
      status: calculateGroupStatus(settings),
      currentWeek: 0, // TODO: Calculate based on group start date and current date
    };

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues - Create a new group
router.post('/', async (req, res) => {
  try {
    const validated = createGroupSchema.parse(req.body);

    // Generate a unique join code
    let joinCode = generateJoinCode();
    let codeExists = await prisma.group.findUnique({ where: { joinCode } });
    while (codeExists) {
      joinCode = generateJoinCode();
      codeExists = await prisma.group.findUnique({ where: { joinCode } });
    }

    const group = await prisma.group.create({
      data: {
        name: validated.name,
        description: validated.description,
        adminUserId: validated.adminUserId,
        type: 'custom',
        maxMembers: validated.settings.groupSize,
        settings: JSON.stringify(validated.settings),
        joinCode,
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
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: validated.adminUserId,
      },
    });

    // Create portfolio for admin with starting balance
    await prisma.fantasyPortfolio.create({
      data: {
        groupId: group.id,
        userId: validated.adminUserId,
        cashBalance: validated.settings.startingBalance,
      },
    });

    const formatted = {
      ...group,
      settings: JSON.parse(group.settings || '{}'),
    };

    res.status(201).json(formatted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:id/join - Join a group
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group._count.memberships >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    // Get user to check learning dollars
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { learningDollarsEarned: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get group settings to check starting balance
    const settings = group.settings ? JSON.parse(group.settings) : {};
    const startingBalance = settings.startingBalance || 10000;

    // Validate user has enough learning dollars
    if (user.learningDollarsEarned < startingBalance) {
      return res.status(403).json({ 
        error: 'Insufficient learning dollars',
        message: `You need at least $${startingBalance} in learning dollars to join this group. You currently have $${user.learningDollarsEarned}.`,
        required: startingBalance,
        available: user.learningDollarsEarned
      });
    }

    // Check if user is already a member
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: id,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Create membership
    const membership = await prisma.groupMembership.create({
      data: {
        groupId: id,
        userId,
      },
    });

    // Create portfolio with starting balance
    await prisma.fantasyPortfolio.create({
      data: {
        groupId: id,
        userId,
        cashBalance: startingBalance,
      },
    });

    res.status(201).json(membership);
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/join-by-code - Join a group by join code
router.post('/join-by-code', async (req, res) => {
  try {
    const { joinCode, userId } = req.body;

    if (!joinCode || !userId) {
      return res.status(400).json({ error: 'joinCode and userId are required' });
    }

    // Find group by join code
    const group = await prisma.group.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Invalid join code' });
    }

    if (group._count.memberships >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    // Get user to check learning dollars
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { learningDollarsEarned: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get group settings to check starting balance
    const settings = group.settings ? JSON.parse(group.settings) : {};
    const startingBalance = settings.startingBalance || 10000;

    // Validate user has enough learning dollars
    if (user.learningDollarsEarned < startingBalance) {
      return res.status(403).json({ 
        error: 'Insufficient learning dollars',
        message: `You need at least $${startingBalance} in learning dollars to join this group. You currently have $${user.learningDollarsEarned}. Complete more lessons to earn learning dollars!`,
        required: startingBalance,
        available: user.learningDollarsEarned
      });
    }

    // Check if user is already a member
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: group.id,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Create membership
    const membership = await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId,
      },
    });

    // Create portfolio with starting balance
    await prisma.fantasyPortfolio.create({
      data: {
        groupId: group.id,
        userId,
        cashBalance: startingBalance,
      },
    });

    res.status(201).json({
      membership,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
      },
    });
  } catch (error) {
    console.error('Error joining group by code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fantasy-leagues/:id/start - Start the competition (admin only)
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const group = await prisma.group.findUnique({
      where: { id },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is the admin
    if (group.adminUserId !== userId) {
      return res.status(403).json({ error: 'Only the group admin can start the competition' });
    }

    // Update the group settings to set the start date to now
    const settings = group.settings ? JSON.parse(group.settings) : {};
    settings.startDate = new Date().toISOString();

    await prisma.group.update({
      where: { id },
      data: {
        settings: JSON.stringify(settings),
      },
    });

    res.json({
      message: 'Competition started successfully',
      startDate: settings.startDate,
    });
  } catch (error) {
    console.error('Error starting competition:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/fantasy-leagues/:id/leave - Leave a group
router.delete('/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: true },
        },
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
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is the admin
    const isAdmin = group.adminUserId === userId;

    // Check if user is a member (admin might not have a membership if they haven't joined)
    const membership = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: id,
        },
      },
    });

    // If user is admin, delete the entire group
    if (isAdmin) {
      // Delete all member portfolios
      await prisma.portfolioSlot.deleteMany({
        where: {
          portfolio: {
            groupId: id,
          },
        },
      });

      await prisma.fantasyPortfolio.deleteMany({
        where: { groupId: id },
      });

      // Delete all memberships
      await prisma.groupMembership.deleteMany({
        where: { groupId: id },
      });

      // Delete all related data
      await prisma.draftPick.deleteMany({
        where: {
          draftState: {
            groupId: id,
          },
        },
      });

      await prisma.draftState.deleteMany({
        where: { groupId: id },
      });

      await prisma.matchup.deleteMany({
        where: { groupId: id },
      });

      await prisma.group.delete({
        where: { id },
      });

      return res.json({
        message: 'Group deleted successfully (admin left).',
        groupDeleted: true,
      });
    }

    // User is not admin, just a regular member
    if (!membership) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    // Delete user's portfolio for this group
    await prisma.fantasyPortfolio.deleteMany({
      where: {
        groupId: id,
        userId,
      },
    });

    // Delete user's portfolio slots (cascade should handle this, but being explicit)
    await prisma.portfolioSlot.deleteMany({
      where: {
        portfolio: {
          groupId: id,
          userId,
        },
      },
    });

    // Delete the membership
    await prisma.groupMembership.delete({
      where: {
        userId_groupId: {
          userId,
          groupId: id,
        },
      },
    });

    // Check if there are any remaining members
    const remainingMembers = await prisma.groupMembership.count({
      where: { groupId: id },
    });

    // If no members remain, delete the group
    if (remainingMembers === 0) {
      // Delete all related data
      await prisma.draftPick.deleteMany({
        where: {
          draftState: {
            groupId: id,
          },
        },
      });

      await prisma.draftState.deleteMany({
        where: { groupId: id },
      });

      await prisma.matchup.deleteMany({
        where: { groupId: id },
      });

      await prisma.group.delete({
        where: { id },
      });

      return res.json({
        message: 'Left group successfully. Group deleted as no members remain.',
        groupDeleted: true,
      });
    }

    res.json({
      message: 'Left group successfully',
      groupDeleted: false,
    });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount draft routes under fantasy-leagues
router.use('/', fantasyDraftRoutes);

export default router;
