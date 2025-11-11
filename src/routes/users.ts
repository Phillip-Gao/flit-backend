import express, { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';

const router = express.Router();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional().transform(str => str ? new Date(str) : undefined),
  phoneNumber: z.string().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  username: z.string().min(3).max(20).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  phoneNumber: z.string().optional(),
  emailVerified: z.boolean().optional(),
  phoneVerified: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
  financialIQScore: z.number().int().optional(),
  learningStreak: z.number().min(0).optional(),
  totalLearningDollars: z.number().min(0).optional(),
});

// GET /users - Get all users with optional pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          phoneNumber: true,
          emailVerified: true,
          phoneVerified: true,
          onboardingComplete: true,
          financialIQScore: true,
          learningStreak: true,
          totalLearningDollars: true,
          createdAt: true,
          lastLoginAt: true,
        }
      }),
      prisma.user.count()
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch users'
    });
  }
});

// GET /users/:id - Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phoneNumber: true,
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
        financialIQScore: true,
        learningStreak: true,
        totalLearningDollars: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with id ${id} does not exist`
      });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user'
    });
  }
});

// POST /users - Create a new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: existingUser.email === validatedData.email 
          ? 'Email is already registered' 
          : 'Username is already taken'
      });
    }

    // Create user
    const user = await prisma.user.create({
      data: validatedData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phoneNumber: true,
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
        financialIQScore: true,
        learningStreak: true,
        totalLearningDollars: true,
        createdAt: true,
      }
    });

    res.status(201).json({
      message: 'User created successfully',
      user
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues
      });
    }

    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user'
    });
  }
});

// PUT /users/:id - Update user by ID
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with id ${id} does not exist`
      });
    }

    // If email or username is being updated, check for conflicts
    if (validatedData.email || validatedData.username) {
      const conflictUser = await prisma.user.findFirst({
        where: {
          AND: [
            {
              OR: [
                validatedData.email ? { email: validatedData.email } : {},
                validatedData.username ? { username: validatedData.username } : {}
              ]
            },
            { NOT: { id } }
          ]
        }
      });

      if (conflictUser) {
        return res.status(400).json({
          error: 'Conflict',
          message: conflictUser.email === validatedData.email 
            ? 'Email is already taken by another user' 
            : 'Username is already taken by another user'
        });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: validatedData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phoneNumber: true,
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
        financialIQScore: true,
        learningStreak: true,
        totalLearningDollars: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      }
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues
      });
    }

    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user'
    });
  }
});

// DELETE /users/:id - Delete user by ID
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with id ${id} does not exist`
      });
    }

    // Delete user
    await prisma.user.delete({
      where: { id }
    });

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete user'
    });
  }
});

export default router;