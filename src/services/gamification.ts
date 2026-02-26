import prisma from './prisma';

/**
 * Calculate Financial IQ Score based on user's learning progress
 * 
 * Formula:
 * - Base score: 500 (starting point)
 * - Lesson completion: +20 points per completed lesson
 * - Quiz performance: +10 bonus points per lesson with score >= 80%
 * - Consistency bonus: +50 points for every 5-lesson streak
 * - Advanced lessons bonus: +30 extra points per advanced lesson
 * 
 * Max theoretical score: ~1500+ (with many completed lessons)
 */
export async function calculateFinancialIQ(userId: string): Promise<number> {
  const BASE_SCORE = 500;
  const LESSON_COMPLETION_POINTS = 20;
  const HIGH_SCORE_BONUS = 10;
  const HIGH_SCORE_THRESHOLD = 80;
  const CONSISTENCY_BONUS_INTERVAL = 5;
  const CONSISTENCY_BONUS_POINTS = 50;
  const ADVANCED_LESSON_BONUS = 30;

  try {
    // Get all completed lessons with scores
    const completedLessons = await prisma.userLesson.findMany({
      where: {
        userId,
        status: 'completed',
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    if (completedLessons.length === 0) {
      return BASE_SCORE;
    }

    let score = BASE_SCORE;

    // Points for lesson completion
    score += completedLessons.length * LESSON_COMPLETION_POINTS;

    // Bonus for high quiz scores
    const highScoreLessons = completedLessons.filter(
      (ul) => ul.score !== null && ul.score >= HIGH_SCORE_THRESHOLD
    );
    score += highScoreLessons.length * HIGH_SCORE_BONUS;

    // Consistency bonus (every 5 lessons)
    const consistencyBonuses = Math.floor(
      completedLessons.length / CONSISTENCY_BONUS_INTERVAL
    );
    score += consistencyBonuses * CONSISTENCY_BONUS_POINTS;

    // Advanced lesson bonus - check lessonId for "advanced" prefix
    const advancedLessons = completedLessons.filter(
      (ul) => ul.lessonId.toLowerCase().includes('advanced')
    );
    score += advancedLessons.length * ADVANCED_LESSON_BONUS;

    // Cap at 1500 for now
    return Math.min(score, 1500);
  } catch (error) {
    console.error('Error calculating financial IQ:', error);
    return BASE_SCORE;
  }
}

/**
 * Calculate daily streak based on lesson completion activity
 * 
 * Logic:
 * - Check dates of lesson completions (using lastActivityDate and completedAt dates)
 * - Count consecutive days with at least one lesson completed
 * - If today or yesterday has activity, streak continues
 * - If last activity was 2+ days ago, streak resets
 */
export async function calculateDailyStreak(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastActivityDate: true },
    });

    if (!user || !user.lastActivityDate) {
      return 0;
    }

    // Get all completed lessons ordered by completion date
    const completedLessons = await prisma.userLesson.findMany({
      where: {
        userId,
        status: 'completed',
        completedAt: { not: null },
      },
      orderBy: {
        completedAt: 'desc',
      },
      select: {
        completedAt: true,
      },
    });

    if (completedLessons.length === 0) {
      return 0;
    }

    // Get unique completion dates (normalize to start of day)
    const uniqueDates = Array.from(
      new Set(
        completedLessons.map((lesson) => {
          const date = new Date(lesson.completedAt!);
          date.setHours(0, 0, 0, 0);
          return date.getTime();
        })
      )
    )
      .sort((a, b) => b - a) // Sort descending (most recent first)
      .map((timestamp) => new Date(timestamp));

    if (uniqueDates.length === 0) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastActivityDate = uniqueDates[0];

    // If last activity was more than 1 day ago, streak is broken
    if (lastActivityDate < yesterday) {
      return 0;
    }

    // Count consecutive days
    let streak = 1;
    let expectedDate = new Date(lastActivityDate);
    expectedDate.setDate(expectedDate.getDate() - 1);

    for (let i = 1; i < uniqueDates.length; i++) {
      const currentDate = uniqueDates[i];
      
      // Check if currentDate matches expectedDate
      if (currentDate.getTime() === expectedDate.getTime()) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        // Gap found, stop counting
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('Error calculating daily streak:', error);
    return 0;
  }
}

/**
 * Update user's gamification stats (Financial IQ and Daily Streak)
 * Call this after a lesson is completed
 */
export async function updateUserGamificationStats(userId: string): Promise<{
  financialIQScore: number;
  learningStreak: number;
}> {
  try {
    const [financialIQScore, learningStreak] = await Promise.all([
      calculateFinancialIQ(userId),
      calculateDailyStreak(userId),
    ]);

    await prisma.user.update({
      where: { id: userId },
      data: {
        financialIQScore,
        learningStreak,
        lastActivityDate: new Date(),
      },
    });

    return { financialIQScore, learningStreak };
  } catch (error) {
    console.error('Error updating gamification stats:', error);
    throw error;
  }
}

/**
 * Check and update streak on login
 * If user logs in but hasn't completed a lesson today, don't break streak yet
 */
export async function checkStreakOnLogin(userId: string): Promise<number> {
  try {
    const streak = await calculateDailyStreak(userId);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        learningStreak: streak,
      },
    });

    return streak;
  } catch (error) {
    console.error('Error checking streak on login:', error);
    return 0;
  }
}
