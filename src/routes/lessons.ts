import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';
import { updateUserGamificationStats } from '../services/gamification';

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
      }
    });

    if (!userLesson) {
      // Return default progress if not started
      // Note: lesson data is now managed by frontend
      return res.json({
        lessonId,
        status: 'not_started',
        progress: 0,
        timeSpent: 0
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

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
      }
    });

    // Update gamification stats if lesson is completed
    if (validatedData.status === 'completed') {
      // Update Financial IQ and Daily Streak
      try {
        await updateUserGamificationStats(userId);
      } catch (error) {
        console.error('Error updating gamification stats:', error);
        // Don't fail the request if gamification update fails
      }
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

    console.log(`[Lesson Sync] Received request for userId: ${userId}, lessons:`, lessons);

    if (!Array.isArray(lessons)) {
      return res.status(400).json({ error: 'Lessons must be an array' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.log(`[Lesson Sync] User not found: ${userId}`);
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

        console.log(`[Lesson Sync] Creating/updating lesson ${lessonId} for user ${userId}`);

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
        console.log(`[Lesson Sync] Successfully saved lesson ${lessonId}`);
      }
    }

    console.log(`[Lesson Sync] Synced ${results.length} lessons`);

    // Update gamification stats after syncing completed lessons
    let statsUpdate = null;
    if (results.length > 0) {
      try {
        console.log(`[Lesson Sync] Updating gamification stats for user ${userId}...`);
        
        // Get current stats before update
        const userBefore = await prisma.user.findUnique({
          where: { id: userId },
          select: { financialIQScore: true, learningStreak: true }
        });
        
        const stats = await updateUserGamificationStats(userId);
        console.log(`[Lesson Sync] ✅ Gamification stats updated:`, stats);
        
        statsUpdate = {
          financialIQScore: stats.financialIQScore,
          learningStreak: stats.learningStreak,
          financialIQEarned: stats.financialIQScore - (userBefore?.financialIQScore || 500),
        };
      } catch (error) {
        console.error('[Lesson Sync] ❌ Error updating gamification stats:', error);
        // Don't fail the request if gamification update fails
      }
    } else {
      console.log('[Lesson Sync] No lessons synced, skipping gamification update');
    }

    res.json({ 
      synced: results.length,
      message: 'Lesson progress synced successfully',
      stats: statsUpdate
    });
  } catch (error) {
    console.error('[Lesson Sync] Error syncing lesson progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;