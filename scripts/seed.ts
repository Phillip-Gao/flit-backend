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

  // Create sample groups with fantasy finance settings
  const groups = await Promise.all([
    prisma.group.create({
      data: {
        name: 'Tech Investors',
        description: 'Group focused on technology stocks and growth investing',
        adminUserId: users[0].id,
        type: 'intermediate',
        maxMembers: 8,
        joinCode: 'TECH123',
        settings: JSON.stringify({
          groupSize: 8,
          startingBalance: 10000,
          competitionPeriod: '3_months',
          startDate: new Date('2024-01-01').toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 1,
          allowShortSelling: false,
          tradingEnabled: true,
        }),
        criteria: JSON.stringify({ minScore: 500, category: 'investing' }),
      },
    }),
    prisma.group.create({
      data: {
        name: 'Value Hunters',
        description: 'Long-term value investing group for patient investors',
        adminUserId: users[1].id,
        type: 'advanced',
        maxMembers: 6,
        joinCode: 'VALUE456',
        settings: JSON.stringify({
          groupSize: 6,
          startingBalance: 25000,
          competitionPeriod: '6_months',
          startDate: new Date('2024-01-15').toISOString(),
          scoringMethod: 'Absolute Gain $',
          enabledAssetClasses: ['Stock', 'ETF', 'REIT'],
          minAssetPrice: 5,
          allowShortSelling: false,
          tradingEnabled: true,
        }),
        criteria: JSON.stringify({ minScore: 700, minStreak: 20 }),
      },
    }),
    prisma.group.create({
      data: {
        name: 'Beginner Traders',
        description: 'Learn the basics of stock trading in a friendly environment',
        adminUserId: users[0].id,
        type: 'beginner',
        maxMembers: 10,
        joinCode: 'BEGIN789',
        settings: JSON.stringify({
          groupSize: 10,
          startingBalance: 5000,
          competitionPeriod: '1_month',
          startDate: new Date('2024-02-01').toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock'],
          minAssetPrice: 1,
          allowShortSelling: false,
          tradingEnabled: true,
        }),
        criteria: JSON.stringify({ minScore: 0, maxScore: 600 }),
      },
    }),
  ]);

  console.log(`✅ Created ${groups.length} groups`);

  // Create group memberships
  await Promise.all([
    prisma.groupMembership.create({
      data: {
        userId: users[0].id, // John - Admin of Tech Investors
        groupId: groups[0].id,
        rank: 2,
        score: 750,
      },
    }),
    prisma.groupMembership.create({
      data: {
        userId: users[1].id, // Jane
        groupId: groups[0].id, // Tech Investors
        rank: 1,
        score: 820,
      },
    }),
    prisma.groupMembership.create({
      data: {
        userId: users[3].id, // Sarah
        groupId: groups[0].id, // Tech Investors
        rank: 3,
        score: 650,
      },
    }),
    prisma.groupMembership.create({
      data: {
        userId: users[1].id, // Jane - Admin of Value Hunters
        groupId: groups[1].id,
        rank: 1,
        score: 820,
      },
    }),
    prisma.groupMembership.create({
      data: {
        userId: users[3].id, // Sarah
        groupId: groups[1].id, // Value Hunters
        rank: 2,
        score: 920,
      },
    }),
    prisma.groupMembership.create({
      data: {
        userId: users[2].id, // Mike
        groupId: groups[1].id, // Value Hunters
        rank: 3,
        score: 680,
      },
    }),
    prisma.groupMembership.create({
      data: {
        userId: users[0].id, // John - Admin of Beginner Traders
        groupId: groups[2].id,
        rank: 1,
        score: 750,
      },
    }),
    prisma.groupMembership.create({
      data: {
        userId: users[2].id, // Mike
        groupId: groups[2].id, // Beginner Traders
        rank: 2,
        score: 680,
      },
    }),
  ]);

  console.log('✅ Created group memberships');

  // Create fantasy portfolios for group members with varied values
  const fantasyPortfolios = await Promise.all([
    // Tech Investors Group Portfolios
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[0].id, // John
        groupId: groups[0].id,
        cashBalance: 2500.00,
        totalValue: 11500.00, // $1,500 gain (15% return)
        
      },
    }),
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[1].id, // Jane
        groupId: groups[0].id,
        cashBalance: 1000.00,
        totalValue: 12800.00, // $2,800 gain (28% return) - Best performer
        
      },
    }),
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[3].id, // Sarah
        groupId: groups[0].id,
        cashBalance: 3200.00,
        totalValue: 10500.00, // $500 gain (5% return)
        
      },
    }),
    // Value Hunters Group Portfolios
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[1].id, // Jane
        groupId: groups[1].id,
        cashBalance: 5000.00,
        totalValue: 28500.00, // $3,500 gain (14% return)
        
      },
    }),
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[3].id, // Sarah
        groupId: groups[1].id,
        cashBalance: 2500.00,
        totalValue: 31200.00, // $6,200 gain (24.8% return) - Best performer
        
      },
    }),
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[2].id, // Mike
        groupId: groups[1].id,
        cashBalance: 8000.00,
        totalValue: 26800.00, // $1,800 gain (7.2% return)
        
      },
    }),
    // Beginner Traders Group Portfolios
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[0].id, // John
        groupId: groups[2].id,
        cashBalance: 1500.00,
        totalValue: 5600.00, // $600 gain (12% return) - Best performer
        
      },
    }),
    prisma.fantasyPortfolio.create({
      data: {
        userId: users[2].id, // Mike
        groupId: groups[2].id,
        cashBalance: 2000.00,
        totalValue: 5200.00, // $200 gain (4% return)
        
      },
    }),
  ]);

  console.log('✅ Created fantasy portfolios with varied values');

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