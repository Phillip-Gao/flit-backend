import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';

const router = Router();

// Validation schemas
const sendFriendRequestSchema = z.object({
  userId: z.string().min(1),
  friendId: z.string().min(1),
});

const respondToFriendRequestSchema = z.object({
  userId: z.string().min(1),
  friendId: z.string().min(1),
  action: z.enum(['accept', 'decline', 'block']),
});

const createLeagueSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  type: z.enum(['beginner', 'intermediate', 'advanced', 'custom']),
  maxMembers: z.number().int().min(5).max(200).default(50),
  criteria: z.string().optional(), // JSON string
});

// GET /api/social/friends/:userId - Get user's friends
router.get('/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status = 'accepted' } = req.query;

    const friends = await prisma.userFriend.findMany({
      where: {
        OR: [
          { userId, status: status as string },
          { friendId: userId, status: status as string },
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            financialIQScore: true,
            learningStreak: true,
          }
        },
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            financialIQScore: true,
            learningStreak: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response to show the friend (not the requesting user)
    const formattedFriends = friends.map((friendship: any) => {
      const friend = friendship.userId === userId ? friendship.friend : friendship.user;
      return {
        id: friendship.id,
        friend,
        status: friendship.status,
        createdAt: friendship.createdAt,
      };
    });

    res.json({
      friends: formattedFriends,
      total: formattedFriends.length
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/friend-requests/:userId - Get pending friend requests
router.get('/friend-requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type = 'received' } = req.query; // 'received' or 'sent'

    const whereClause = type === 'received' 
      ? { friendId: userId, status: 'pending' }
      : { userId, status: 'pending' };

    const requests = await prisma.userFriend.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      requests,
      total: requests.length
    });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/social/friend-request - Send friend request
router.post('/friend-request', async (req, res) => {
  try {
    const validatedData = sendFriendRequestSchema.parse(req.body);
    const { userId, friendId } = validatedData;

    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.userFriend.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ]
      }
    });

    if (existingFriendship) {
      return res.status(400).json({ 
        error: 'Friendship request already exists',
        status: existingFriendship.status
      });
    }

    // Check if users exist
    const [user, friend] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findUnique({ where: { id: friendId } })
    ]);

    if (!user || !friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendRequest = await prisma.userFriend.create({
      data: {
        userId,
        friendId,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    res.status(201).json(friendRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/social/friend-request - Respond to friend request
router.put('/friend-request', async (req, res) => {
  try {
    const validatedData = respondToFriendRequestSchema.parse(req.body);
    const { userId, friendId, action } = validatedData;

    const friendship = await prisma.userFriend.findFirst({
      where: {
        userId: friendId, // The original sender
        friendId: userId, // The receiver (current user)
        status: 'pending',
      }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (action === 'decline') {
      await prisma.userFriend.delete({
        where: { id: friendship.id }
      });
      res.json({ message: 'Friend request declined' });
    } else {
      const updatedFriendship = await prisma.userFriend.update({
        where: { id: friendship.id },
        data: { 
          status: action === 'accept' ? 'accepted' : 'blocked' 
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            }
          },
          friend: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      });
      res.json(updatedFriendship);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/leagues - Get all leagues
router.get('/leagues', async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where: any = { isActive: true };
    if (type) where.type = type;

    const [leagues, total] = await Promise.all([
      prisma.league.findMany({
        where,
        include: {
          _count: {
            select: {
              memberships: {
                where: { isActive: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: offset,
      }),
      prisma.league.count({ where })
    ]);

    const leaguesWithStats = leagues.map((league: any) => ({
      ...league,
      memberCount: league._count.memberships,
      _count: undefined, // Remove the count object
    }));

    res.json({
      leagues: leaguesWithStats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/leagues/:id - Get league details with members
router.get('/leagues/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                financialIQScore: true,
                learningStreak: true,
              }
            }
          },
          orderBy: [
            { rank: 'asc' },
            { score: 'desc' }
          ]
        }
      }
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    res.json(league);
  } catch (error) {
    console.error('Error fetching league:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/users/:userId/leagues - Get user's leagues
router.get('/users/:userId/leagues', async (req, res) => {
  try {
    const { userId } = req.params;

    const memberships = await prisma.leagueMembership.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        league: {
          include: {
            _count: {
              select: {
                memberships: {
                  where: { isActive: true }
                }
              }
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    const userLeagues = memberships.map((membership: any) => ({
      ...membership.league,
      memberCount: membership.league._count.memberships,
      userRank: membership.rank,
      userScore: membership.score,
      joinedAt: membership.joinedAt,
      _count: undefined,
    }));

    res.json({
      leagues: userLeagues,
      total: userLeagues.length
    });
  } catch (error) {
    console.error('Error fetching user leagues:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/social/leagues/:id/join - Join a league
router.post('/leagues/:id/join', async (req, res) => {
  try {
    const { id: leagueId } = req.params;
    const { userId } = req.body;

    // Check if league exists and has space
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        _count: {
          select: {
            memberships: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    if (!league.isActive) {
      return res.status(400).json({ error: 'League is not active' });
    }

    if (league._count.memberships >= league.maxMembers) {
      return res.status(400).json({ error: 'League is full' });
    }

    // Check if user is already a member
    const existingMembership = await prisma.leagueMembership.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        }
      }
    });

    if (existingMembership && existingMembership.isActive) {
      return res.status(400).json({ error: 'Already a member of this league' });
    }

    // Join league
    const membership = await prisma.leagueMembership.upsert({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        }
      },
      update: {
        isActive: true,
        joinedAt: new Date(),
      },
      create: {
        userId,
        leagueId,
      },
      include: {
        league: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    res.status(201).json(membership);
  } catch (error) {
    console.error('Error joining league:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/social/leagues/:id/leave - Leave a league
router.delete('/leagues/:id/leave', async (req, res) => {
  try {
    const { id: leagueId } = req.params;
    const { userId } = req.body;

    const membership = await prisma.leagueMembership.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        }
      }
    });

    if (!membership || !membership.isActive) {
      return res.status(404).json({ error: 'Not a member of this league' });
    }

    await prisma.leagueMembership.update({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        }
      },
      data: {
        isActive: false,
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error leaving league:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;