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

// GET /api/social/groups - Get all groups
router.get('/groups', async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where: any = { isActive: true };
    if (type) where.type = type;

    const [leagues, total] = await Promise.all([
      prisma.group.findMany({
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
      prisma.group.count({ where })
    ]);

    const groupsWithStats = leagues.map((group: any) => ({
      ...group,
      memberCount: group._count.memberships,
      _count: undefined, // Remove the count object
    }));

    res.json({
      groups: groupsWithStats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/groups/:id - Get group details with members
router.get('/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({
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

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/users/:userId/groups - Get user's groups
router.get('/users/:userId/groups', async (req, res) => {
  try {
    const { userId } = req.params;

    const memberships = await prisma.groupMembership.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        group: {
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

    const userGroups = memberships.map((membership: any) => ({
      ...membership.group,
      memberCount: membership.group._count.memberships,
      userRank: membership.rank,
      userScore: membership.score,
      joinedAt: membership.joinedAt,
      _count: undefined,
    }));

    res.json({
      groups: userGroups,
      total: userGroups.length
    });
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/social/groups/:id/join - Join a group
router.post('/groups/:id/join', async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { userId } = req.body;

    // Check if group exists and has space
    const group = await prisma.group.findUnique({
      where: { id: groupId },
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

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isActive) {
      return res.status(400).json({ error: 'Group is not active' });
    }

    if (group._count.memberships >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    // Check if user is already a member
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        }
      }
    });

    if (existingMembership && existingMembership.isActive) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Join group
    const membership = await prisma.groupMembership.upsert({
      where: {
        userId_groupId: {
          userId,
          groupId,
        }
      },
      update: {
        isActive: true,
        joinedAt: new Date(),
      },
      create: {
        userId,
        groupId,
      },
      include: {
        group: true,
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
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/social/groups/:id/leave - Leave a group
router.delete('/groups/:id/leave', async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { userId } = req.body;

    const membership = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        }
      }
    });

    if (!membership || !membership.isActive) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    await prisma.groupMembership.update({
      where: {
        userId_groupId: {
          userId,
          groupId,
        }
      },
      data: {
        isActive: false,
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;