/**
 * Comprehensive seed script for phillipgao user with mock users in groups
 * Creates multiple users with portfolios in Tech Investors and Value Hunters groups
 */

import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/services/prisma';
import { Decimal } from '@prisma/client/runtime/library';

async function seedWithMockUsers() {
  console.log('🌱 Seeding phillipgao user and mock users...\n');

  try {
    // 1. Create phillipgao (main user)
    const phillipgao = await prisma.user.upsert({
      where: { email: 'philgao@seas.upenn.edu' },
      update: {
        username: 'phillipgao',
        firstName: 'Phillip',
        lastName: 'Gao',
        dateOfBirth: new Date('2003-09-21T00:00:00.000Z'),
        phoneNumber: '484-767-7883',
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
        financialIQScore: 850,
        learningStreak: 15,
        totalLearningDollars: 10000,
        learningDollarsEarned: 10000,
        currentUnit: 3,
        currentLesson: 5,
      },
      create: {
        email: 'philgao@seas.upenn.edu',
        username: 'phillipgao',
        firstName: 'Phillip',
        lastName: 'Gao',
        dateOfBirth: new Date('2003-09-21T00:00:00.000Z'),
        phoneNumber: '484-767-7883',
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
        financialIQScore: 850,
        learningStreak: 15,
        totalLearningDollars: 10000,
        learningDollarsEarned: 10000,
        currentUnit: 3,
        currentLesson: 5,
        completedLessons: ['lesson_1', 'lesson_2', 'lesson_3'],
      },
    });

    console.log(`✅ Created/Updated user: ${phillipgao.username} (${phillipgao.email})`);

    // 2. Create mock users
    const mockUsersData = [
      { email: 'sarah.chen@example.com', username: 'sarah_chen', firstName: 'Sarah', lastName: 'Chen' },
      { email: 'mike.ross@example.com', username: 'mike_ross', firstName: 'Mike', lastName: 'Ross' },
      { email: 'emily.wong@example.com', username: 'emily_wong', firstName: 'Emily', lastName: 'Wong' },
      { email: 'david.kim@example.com', username: 'david_kim', firstName: 'David', lastName: 'Kim' },
      { email: 'jessica.lee@example.com', username: 'jessica_lee', firstName: 'Jessica', lastName: 'Lee' },
      { email: 'ryan.park@example.com', username: 'ryan_park', firstName: 'Ryan', lastName: 'Park' },
    ];

    const mockUsers = [];
    for (const userData of mockUsersData) {
      const user = await prisma.user.upsert({
        where: { username: userData.username },
        update: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
        create: {
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          emailVerified: true,
          onboardingComplete: true,
          financialIQScore: 500 + Math.floor(Math.random() * 400),
          learningStreak: Math.floor(Math.random() * 30),
          totalLearningDollars: 5000 + Math.floor(Math.random() * 5000),
          learningDollarsEarned: 500,
          completedLessons: [],
        },
      });
      mockUsers.push(user);
      console.log(`✅ Created/Updated mock user: ${user.username}`);
    }

    const allUsers = [phillipgao, ...mockUsers];

    // 3. Create groups with settings
    const groupSettings = {
      groupSize: 10,
      startingBalance: 10000,
      competitionPeriod: '3_months',
      startDate: new Date('2026-01-01').toISOString(),
      scoringMethod: 'Total Return %',
      enabledAssetClasses: ['Stock', 'ETF'],
      minAssetPrice: 1,
      allowShortSelling: false,
      tradingEnabled: true,
    };

    const techInvestorsGroup = await prisma.group.upsert({
      where: { id: 'tech-investors-group' },
      update: {
        name: 'Tech Investors',
        description: 'Focus on technology stocks and innovation',
        settings: JSON.stringify(groupSettings),
      },
      create: {
        id: 'tech-investors-group',
        name: 'Tech Investors',
        description: 'Focus on technology stocks and innovation',
        adminUserId: phillipgao.id,
        type: 'intermediate',
        maxMembers: 10,
        isActive: true,
        settings: JSON.stringify(groupSettings),
      },
    });

    console.log(`✅ Created/Updated group: ${techInvestorsGroup.name}`);

    const valueHuntersGroup = await prisma.group.upsert({
      where: { id: 'value-hunters-group' },
      update: {
        name: 'Value Hunters',
        description: 'Finding undervalued stocks with strong fundamentals',
        settings: JSON.stringify(groupSettings),
      },
      create: {
        id: 'value-hunters-group',
        name: 'Value Hunters',
        description: 'Finding undervalued stocks with strong fundamentals',
        adminUserId: phillipgao.id,
        type: 'advanced',
        maxMembers: 10,
        isActive: true,
        settings: JSON.stringify(groupSettings),
      },
    });

    console.log(`✅ Created/Updated group: ${valueHuntersGroup.name}`);

    // 4. Create memberships for all users in both groups
    console.log('\n📋 Creating group memberships...');

    for (const user of allUsers) {
      // Tech Investors membership
      await prisma.groupMembership.upsert({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId: techInvestorsGroup.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          groupId: techInvestorsGroup.id,
        },
      });

      // Value Hunters membership
      await prisma.groupMembership.upsert({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId: valueHuntersGroup.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          groupId: valueHuntersGroup.id,
        },
      });
    }

    console.log(`✅ Created memberships for ${allUsers.length} users in both groups`);

    // 5. Fetch some assets for portfolio holdings
    const assets = await prisma.asset.findMany({
      where: {
        ticker: { in: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'TSLA', 'AMZN'] },
      },
    });

    const assetMap = new Map(assets.map(a => [a.ticker, a]));

    // 6. Create portfolios with holdings for Tech Investors
    console.log('\n💼 Creating Tech Investors portfolios...');

    const techPortfolios = [
      { user: phillipgao, cash: 7500, holdings: [{ ticker: 'AAPL', shares: 10 }] },
      { user: mockUsers[0], cash: 3200, holdings: [{ ticker: 'GOOGL', shares: 15 }, { ticker: 'META', shares: 5 }] },
      { user: mockUsers[1], cash: 2100, holdings: [{ ticker: 'MSFT', shares: 8 }, { ticker: 'NVDA', shares: 3 }] },
      { user: mockUsers[2], cash: 4500, holdings: [{ ticker: 'AAPL', shares: 12 }, { ticker: 'GOOGL', shares: 8 }] },
      { user: mockUsers[3], cash: 1800, holdings: [{ ticker: 'NVDA', shares: 5 }, { ticker: 'META', shares: 4 }] },
      { user: mockUsers[4], cash: 5200, holdings: [{ ticker: 'MSFT', shares: 6 }] },
      { user: mockUsers[5], cash: 3600, holdings: [{ ticker: 'AAPL', shares: 8 }, { ticker: 'TSLA', shares: 4 }] },
    ];

    for (const { user, cash, holdings } of techPortfolios) {
      const portfolio = await prisma.fantasyPortfolio.upsert({
        where: {
          groupId_userId: {
            userId: user.id,
            groupId: techInvestorsGroup.id,
          },
        },
        update: {
          cashBalance: new Decimal(cash),
          totalValue: new Decimal(10000),
        },
        create: {
          userId: user.id,
          groupId: techInvestorsGroup.id,
          cashBalance: new Decimal(cash),
          totalValue: new Decimal(10000),
        },
      });

      // Create holdings
      for (const holding of holdings) {
        const asset = assetMap.get(holding.ticker);
        if (!asset) continue;

        const avgCost = Number(asset.currentPrice) * (0.9 + Math.random() * 0.2); // ±10% variance
        const totalValue = holding.shares * Number(asset.currentPrice);
        const gainLoss = totalValue - holding.shares * avgCost;
        const gainLossPercent = (gainLoss / (holding.shares * avgCost)) * 100;

        await prisma.portfolioSlot.upsert({
          where: {
            portfolioId_assetId: {
              portfolioId: portfolio.id,
              assetId: asset.id,
            },
          },
          update: {
            shares: new Decimal(holding.shares),
            averageCost: new Decimal(avgCost),
            currentPrice: asset.currentPrice,
            totalValue: new Decimal(totalValue),
            gainLoss: new Decimal(gainLoss),
            gainLossPercent: new Decimal(gainLossPercent),
          },
          create: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            shares: new Decimal(holding.shares),
            averageCost: new Decimal(avgCost),
            currentPrice: asset.currentPrice,
            totalValue: new Decimal(totalValue),
            gainLoss: new Decimal(gainLoss),
            gainLossPercent: new Decimal(gainLossPercent),
          },
        });
      }

      console.log(`  ✅ ${user.username}: $${cash} cash, ${holdings.length} holdings`);
    }

    // 7. Create portfolios with holdings for Value Hunters
    console.log('\n💼 Creating Value Hunters portfolios...');

    const valuePortfolios = [
      { user: phillipgao, cash: 6800, holdings: [{ ticker: 'MSFT', shares: 8 }] },
      { user: mockUsers[0], cash: 4100, holdings: [{ ticker: 'AAPL', shares: 10 }, { ticker: 'AMZN', shares: 12 }] },
      { user: mockUsers[1], cash: 2900, holdings: [{ ticker: 'GOOGL', shares: 20 }, { ticker: 'TSLA', shares: 3 }] },
      { user: mockUsers[2], cash: 5300, holdings: [{ ticker: 'META', shares: 6 }] },
      { user: mockUsers[3], cash: 3400, holdings: [{ ticker: 'NVDA', shares: 4 }, { ticker: 'MSFT', shares: 5 }] },
      { user: mockUsers[4], cash: 1900, holdings: [{ ticker: 'AAPL', shares: 15 }, { ticker: 'GOOGL', shares: 10 }] },
      { user: mockUsers[5], cash: 4700, holdings: [{ ticker: 'AMZN', shares: 10 }, { ticker: 'META', shares: 3 }] },
    ];

    for (const { user, cash, holdings } of valuePortfolios) {
      const portfolio = await prisma.fantasyPortfolio.upsert({
        where: {
          groupId_userId: {
            userId: user.id,
            groupId: valueHuntersGroup.id,
          },
        },
        update: {
          cashBalance: new Decimal(cash),
          totalValue: new Decimal(10000),
        },
        create: {
          userId: user.id,
          groupId: valueHuntersGroup.id,
          cashBalance: new Decimal(cash),
          totalValue: new Decimal(10000),
        },
      });

      // Create holdings
      for (const holding of holdings) {
        const asset = assetMap.get(holding.ticker);
        if (!asset) continue;

        const avgCost = Number(asset.currentPrice) * (0.9 + Math.random() * 0.2); // ±10% variance
        const totalValue = holding.shares * Number(asset.currentPrice);
        const gainLoss = totalValue - holding.shares * avgCost;
        const gainLossPercent = (gainLoss / (holding.shares * avgCost)) * 100;

        await prisma.portfolioSlot.upsert({
          where: {
            portfolioId_assetId: {
              portfolioId: portfolio.id,
              assetId: asset.id,
            },
          },
          update: {
            shares: new Decimal(holding.shares),
            averageCost: new Decimal(avgCost),
            currentPrice: asset.currentPrice,
            totalValue: new Decimal(totalValue),
            gainLoss: new Decimal(gainLoss),
            gainLossPercent: new Decimal(gainLossPercent),
          },
          create: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            shares: new Decimal(holding.shares),
            averageCost: new Decimal(avgCost),
            currentPrice: asset.currentPrice,
            totalValue: new Decimal(totalValue),
            gainLoss: new Decimal(gainLoss),
            gainLossPercent: new Decimal(gainLossPercent),
          },
        });
      }

      console.log(`  ✅ ${user.username}: $${cash} cash, ${holdings.length} holdings`);
    }

    console.log('\n✅ Seeding complete!');
    console.log(`\nSummary:`);
    console.log(`  Users: ${allUsers.length} (1 main + ${mockUsers.length} mock)`);
    console.log(`  Groups: 2 (Tech Investors, Value Hunters)`);
    console.log(`  Portfolios: ${allUsers.length * 2} (${allUsers.length} per group)`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

seedWithMockUsers()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
