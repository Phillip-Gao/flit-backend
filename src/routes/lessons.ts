import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';

const router = Router();

// Validation schemas
const createLessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string(),
  category: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedTime: z.number().int().positive(),
  rewardDollars: z.number().default(0),
  order: z.number().int().default(0),
});

const updateLessonSchema = createLessonSchema.partial();

const updateUserLessonSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  score: z.number().int().min(0).max(100).optional(),
  timeSpent: z.number().int().min(0).optional(),
});

// GET /api/lessons - Get all lessons
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, difficulty } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;

    const [lessons, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        orderBy: { order: 'asc' },
        take: Number(limit),
        skip: offset,
      }),
      prisma.lesson.count({ where })
    ]);

    res.json({
      lessons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lessons/:id - Get lesson by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const lesson = await prisma.lesson.findUnique({
      where: { id },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/lessons - Create new lesson
router.post('/', async (req, res) => {
  try {
    const validatedData = createLessonSchema.parse(req.body);
    
    const lesson = await prisma.lesson.create({
      data: validatedData,
    });

    res.status(201).json(lesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating lesson:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/lessons/:id - Update lesson
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateLessonSchema.parse(req.body);

    const lesson = await prisma.lesson.update({
      where: { id },
      data: validatedData,
    });

    res.json(lesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error updating lesson:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/lessons/:id - Delete lesson (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.lesson.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lessons/progress/:userId - Get all lesson progress for a user
router.get('/progress/:userId/all', async (req, res) => {
  try {
    const { userId } = req.params;

    const userLessons = await prisma.userLesson.findMany({
      where: { userId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            category: true,
            rewardDollars: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(userLessons);
  } catch (error) {
    console.error('Error fetching user lesson progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lessons/:id/progress/:userId - Get user's progress on a lesson
router.get('/:id/progress/:userId', async (req, res) => {
  try {
    const { id: lessonId, userId } = req.params;
    
    const userLesson = await prisma.userLesson.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      },
      include: {
        lesson: {
          select: {
            title: true,
            estimatedTime: true,
            rewardDollars: true
          }
        }
      }
    });

    if (!userLesson) {
      // Return default progress if not started
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { title: true, estimatedTime: true, rewardDollars: true }
      });
      
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      return res.json({
        status: 'not_started',
        progress: 0,
        timeSpent: 0,
        lesson
      });
    }

    res.json(userLesson);
  } catch (error) {
    console.error('Error fetching lesson progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/lessons/:id/progress/:userId - Update user's lesson progress
router.put('/:id/progress/:userId', async (req, res) => {
  try {
    const { id: lessonId, userId } = req.params;
    const validatedData = updateUserLessonSchema.parse(req.body);

    // Check if lesson and user exist
    const [lesson, user] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: lessonId } }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!lesson || !user) {
      return res.status(404).json({ error: 'Lesson or user not found' });
    }

    // Set completedAt if status is completed
    const updateData: any = { ...validatedData };
    if (validatedData.status === 'completed' && !updateData.completedAt) {
      updateData.completedAt = new Date();
    }

    const userLesson = await prisma.userLesson.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      },
      update: updateData,
      create: {
        userId,
        lessonId,
        ...updateData
      },
      include: {
        lesson: {
          select: {
            title: true,
            rewardDollars: true
          }
        }
      }
    });

    // Award learning dollars if lesson is completed
    if (validatedData.status === 'completed') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalLearningDollars: {
            increment: lesson.rewardDollars
          }
        }
      });
    }

    res.json(userLesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error updating lesson progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/lessons/progress/:userId/sync - Bulk sync lesson progress
router.post('/progress/:userId/sync', async (req, res) => {
  try {
    const { userId } = req.params;
    const { lessons } = req.body; // Array of { lessonId, courseId, status, score, totalQuestions }

    if (!Array.isArray(lessons)) {
      return res.status(400).json({ error: 'Lessons must be an array' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = [];
    let totalRewards = 0;

    for (const lessonData of lessons) {
      const { lessonId, status, score, totalQuestions } = lessonData;

      // For now, we're using frontend lesson IDs which may not match backend
      // We'll upsert with the provided data
      if (status === 'completed') {
        const progress = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 100;

        const userLesson = await prisma.userLesson.upsert({
          where: {
            userId_lessonId: {
              userId,
              lessonId: lessonId || `frontend_${Date.now()}_${Math.random()}`
            }
          },
          update: {
            status,
            progress,
            score,
            completedAt: new Date()
          },
          create: {
            userId,
            lessonId: lessonId || `frontend_${Date.now()}_${Math.random()}`,
            status,
            progress,
            score,
            completedAt: new Date()
          }
        });

        results.push(userLesson);
      }
    }

    res.json({ 
      synced: results.length,
      message: 'Lesson progress synced successfully'
    });
  } catch (error) {
    console.error('Error syncing lesson progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;