import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create sample users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'john.doe@example.com',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-05-15'),
        financialIQScore: 750,
        learningStreak: 15,
        totalLearningDollars: 125.50,
        emailVerified: true,
        phoneVerified: false,
        onboardingComplete: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'jane.smith@example.com',
        username: 'janesmith',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: new Date('1988-08-22'),
        financialIQScore: 820,
        learningStreak: 23,
        totalLearningDollars: 289.75,
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'mike.wilson@example.com',
        username: 'mikewilson',
        firstName: 'Mike',
        lastName: 'Wilson',
        dateOfBirth: new Date('1992-12-10'),
        financialIQScore: 680,
        learningStreak: 7,
        totalLearningDollars: 45.25,
        emailVerified: false,
        phoneVerified: false,
        onboardingComplete: false,
      },
    }),
    prisma.user.create({
      data: {
        email: 'sarah.johnson@example.com',
        username: 'sarahjohnson',
        firstName: 'Sarah',
        lastName: 'Johnson',
        dateOfBirth: new Date('1995-03-18'),
        financialIQScore: 920,
        learningStreak: 45,
        totalLearningDollars: 567.80,
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users:`);
  users.forEach((user) => {
    console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
  });

  // Create sample lessons
  const lessons = await Promise.all([
    prisma.lesson.create({
      data: {
        title: 'Introduction to Budgeting',
        description: 'Learn the basics of creating and managing a personal budget',
        content: 'A comprehensive guide to budgeting fundamentals...',
        category: 'budgeting',
        difficulty: 'beginner',
        estimatedTime: 15,
        rewardDollars: 10.0,
        order: 1,
      },
    }),
    prisma.lesson.create({
      data: {
        title: 'Understanding Compound Interest',
        description: 'Discover how compound interest can grow your wealth over time',
        content: 'The magic of compound interest explained...',
        category: 'investing',
        difficulty: 'beginner',
        estimatedTime: 20,
        rewardDollars: 15.0,
        order: 2,
      },
    }),
    prisma.lesson.create({
      data: {
        title: 'Stock Market Basics',
        description: 'An introduction to stocks, bonds, and market fundamentals',
        content: 'Understanding the stock market landscape...',
        category: 'investing',
        difficulty: 'intermediate',
        estimatedTime: 30,
        rewardDollars: 25.0,
        order: 3,
      },
    }),
    prisma.lesson.create({
      data: {
        title: 'Building an Emergency Fund',
        description: 'Why and how to build a financial safety net',
        content: 'Emergency fund strategies and best practices...',
        category: 'saving',
        difficulty: 'beginner',
        estimatedTime: 12,
        rewardDollars: 12.0,
        order: 4,
      },
    }),
  ]);

  console.log(`✅ Created ${lessons.length} lessons`);

  // Create some lesson progress for users
  await Promise.all([
    prisma.userLesson.create({
      data: {
        userId: users[0].id,
        lessonId: lessons[0].id,
        status: 'completed',
        progress: 100,
        score: 95,
        timeSpent: 18,
        completedAt: new Date(),
      },
    }),
    prisma.userLesson.create({
      data: {
        userId: users[0].id,
        lessonId: lessons[1].id,
        status: 'in_progress',
        progress: 60,
        timeSpent: 12,
      },
    }),
    prisma.userLesson.create({
      data: {
        userId: users[1].id,
        lessonId: lessons[0].id,
        status: 'completed',
        progress: 100,
        score: 88,
        timeSpent: 15,
        completedAt: new Date(),
      },
    }),
  ]);

  console.log('✅ Created lesson progress records');

  // Create sample portfolio holdings
  await Promise.all([
    prisma.portfolioHolding.create({
      data: {
        userId: users[0].id,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        shares: 10,
        averageCost: 150.00,
        currentPrice: 175.00,
        totalValue: 1750.00,
        gainLoss: 250.00,
        gainLossPercent: 16.67,
      },
    }),
    prisma.portfolioHolding.create({
      data: {
        userId: users[0].id,
        symbol: 'GOOGL',
        companyName: 'Alphabet Inc.',
        shares: 5,
        averageCost: 2500.00,
        currentPrice: 2750.00,
        totalValue: 13750.00,
        gainLoss: 1250.00,
        gainLossPercent: 10.00,
      },
    }),
    prisma.portfolioHolding.create({
      data: {
        userId: users[1].id,
        symbol: 'TSLA',
        companyName: 'Tesla Inc.',
        shares: 8,
        averageCost: 800.00,
        currentPrice: 900.00,
        totalValue: 7200.00,
        gainLoss: 800.00,
        gainLossPercent: 12.50,
      },
    }),
  ]);

  console.log('✅ Created portfolio holdings');

  // Create sample leagues
  const leagues = await Promise.all([
    prisma.league.create({
      data: {
        name: 'Beginner Investors',
        description: 'A league for those just starting their investment journey',
        type: 'beginner',
        maxMembers: 30,
        criteria: JSON.stringify({ minScore: 0, maxScore: 500 }),
      },
    }),
    prisma.league.create({
      data: {
        name: 'Budgeting Masters',
        description: 'For users who excel at budgeting and saving',
        type: 'intermediate',
        maxMembers: 25,
        criteria: JSON.stringify({ categories: ['budgeting', 'saving'] }),
      },
    }),
    prisma.league.create({
      data: {
        name: 'High Achievers',
        description: 'Elite league for top financial literacy champions',
        type: 'advanced',
        maxMembers: 15,
        criteria: JSON.stringify({ minScore: 800, minStreak: 30 }),
      },
    }),
  ]);

  console.log(`✅ Created ${leagues.length} leagues`);

  // Create league memberships
  await Promise.all([
    prisma.leagueMembership.create({
      data: {
        userId: users[0].id, // John
        leagueId: leagues[0].id, // Beginner Investors
        rank: 2,
        score: 750,
      },
    }),
    prisma.leagueMembership.create({
      data: {
        userId: users[1].id, // Jane
        leagueId: leagues[1].id, // Budgeting Masters
        rank: 1,
        score: 820,
      },
    }),
    prisma.leagueMembership.create({
      data: {
        userId: users[1].id, // Jane
        leagueId: leagues[2].id, // High Achievers
        rank: 3,
        score: 820,
      },
    }),
    prisma.leagueMembership.create({
      data: {
        userId: users[3].id, // Sarah
        leagueId: leagues[2].id, // High Achievers
        rank: 1,
        score: 920,
      },
    }),
  ]);

  console.log('✅ Created league memberships');

  // Create some friendships
  await Promise.all([
    prisma.userFriend.create({
      data: {
        userId: users[0].id, // John
        friendId: users[1].id, // Jane
        status: 'accepted',
      },
    }),
    prisma.userFriend.create({
      data: {
        userId: users[0].id, // John  
        friendId: users[3].id, // Sarah
        status: 'accepted',
      },
    }),
    prisma.userFriend.create({
      data: {
        userId: users[1].id, // Jane
        friendId: users[3].id, // Sarah
        status: 'accepted',
      },
    }),
    prisma.userFriend.create({
      data: {
        userId: users[2].id, // Mike
        friendId: users[0].id, // John
        status: 'pending', // Friend request pending
      },
    }),
  ]);

  console.log('✅ Created friendships');
  console.log('🎉 Seeding completed!');
}

seed()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });