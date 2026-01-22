/**
 * Seed script for phillipgao user with portfolios
 * Creates the user and portfolios for Tech Investors and Value Hunters groups
 */

import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/services/prisma';

async function seedPhillipGao() {
  console.log('🌱 Seeding phillipgao user and groups with members...\n');

  try {
    // 1. Create or update the main user (phillipgao)
    const user = await prisma.user.upsert({
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
        completedLessons: ['lesson_1', 'lesson_2', 'lesson_3'], // Completed some lessons
      },
    });

    console.log(`✅ Created/Updated user: ${user.username} (${user.email})`);

    // 2. Create additional mock users
    const mockUsers = [
      { username: 'sarah_chen', email: 'sarah@example.com', firstName: 'Sarah', lastName: 'Chen' },
      { username: 'mike_ross', email: 'mike@example.com', firstName: 'Mike', lastName: 'Ross' },
      { username: 'emily_wong', email: 'emily@example.com', firstName: 'Emily', lastName: 'Wong' },
      { username: 'david_kim', email: 'david@example.com', firstName: 'David', lastName: 'Kim' },
    ];

    const additionalUsers = [];
    for (const userData of mockUsers) {
      const mockUser = await prisma.user.upsert({
        where: { email: userData.email },
        update: userData,
        create: {
          ...userData,
          emailVerified: true,
          onboardingComplete: true,
          financialIQScore: Math.floor(Math.random() * 200) + 600, // 600-800
          completedLessons: [],
        },
      });
      additionalUsers.push(mockUser);
      console.log(`✅ Created/Updated mock user: ${mockUser.username}`);
    }

    // 2. Create Tech Investors group
    const techInvestorsGroup = await prisma.group.upsert({
      where: { id: 'tech-investors-group' },
      update: {
        name: 'Tech Investors',
        description: 'Focus on technology stocks and innovation',
        settings: JSON.stringify({
          groupSize: 10,
          startingBalance: 10000,
          competitionPeriod: '3_months',
          startDate: new Date('2026-01-01').toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 1,
          allowShortSelling: false,
          tradingEnabled: true,
        }),
      },
      create: {
        id: 'tech-investors-group',
        name: 'Tech Investors',
        description: 'Focus on technology stocks and innovation',
        adminUserId: user.id,
        type: 'intermediate',
        maxMembers: 10,
        isActive: true,
        settings: JSON.stringify({
          groupSize: 10,
          startingBalance: 10000,
          competitionPeriod: '3_months',
          startDate: new Date('2026-01-01').toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 1,
          allowShortSelling: false,
          tradingEnabled: true,
        }),
      },
    });

    console.log(`✅ Created/Updated group: ${techInvestorsGroup.name}`);

    // 3. Create Value Hunters group
    const valueHuntersGroup = await prisma.group.upsert({
      where: { id: 'value-hunters-group' },
      update: {
        name: 'Value Hunters',
        description: 'Finding undervalued stocks with strong fundamentals',
        settings: JSON.stringify({
          groupSize: 10,
          startingBalance: 10000,
          competitionPeriod: '3_months',
          startDate: new Date('2026-01-01').toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 1,
          allowShortSelling: false,
          tradingEnabled: true,
        }),
      },
      create: {
        id: 'value-hunters-group',
        name: 'Value Hunters',
        description: 'Finding undervalued stocks with strong fundamentals',
        adminUserId: user.id,
        type: 'advanced',
        maxMembers: 10,
        isActive: true,
        settings: JSON.stringify({
          groupSize: 10,
          startingBalance: 10000,
          competitionPeriod: '3_months',
          startDate: new Date('2026-01-01').toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 1,
          allowShortSelling: false,
          tradingEnabled: true,
        }),
      },
    });

    console.log(`✅ Created/Updated group: ${valueHuntersGroup.name}`);

    // 4. Create memberships for all users in both groups
    const allUsers = [user, ...additionalUsers];
    
    for (const member of allUsers) {
      // Add to Tech Investors
      await prisma.groupMembership.upsert({
        where: {
          userId_groupId: {
            userId: member.id,
            groupId: techInvestorsGroup.id,
          },
        },
        update: {},
        create: {
          userId: member.id,
          groupId: techInvestorsGroup.id,
        },
      });

      // Add to Value Hunters
      await prisma.groupMembership.upsert({
        where: {
          userId_groupId: {
            userId: member.id,
            groupId: valueHuntersGroup.id,
          },
        },
        update: {},
        create: {
          userId: member.id,
          groupId: valueHuntersGroup.id,
        },
      });
    }

    console.log(`✅ Created memberships for ${allUsers.length} users in both groups`);

    // 5. Create fantasy portfolios for all users
    for (const member of allUsers) {
      // Tech Investors portfolio
      await prisma.fantasyPortfolio.upsert({
        where: {
          groupId_userId: {
            userId: member.id,
            groupId: techInvestorsGroup.id,
          },
        },
        update: {
          cashBalance: member.id === user.id ? undefined : 10000, // Keep phillipgao's existing balance
          totalValue: member.id === user.id ? undefined : 10000,
        },
        create: {
          userId: member.id,
          groupId: techInvestorsGroup.id,
          cashBalance: 10000,
          totalValue: 10000,
        },
      });

      // Value Hunters portfolio
      await prisma.fantasyPortfolio.upsert({
        where: {
          groupId_userId: {
            userId: member.id,
            groupId: valueHuntersGroup.id,
          },
        },
        update: {
          cashBalance: member.id === user.id ? undefined : 10000, // Keep phillipgao's existing balance
          totalValue: member.id === user.id ? undefined : 10000,
        },
        create: {
          userId: member.id,
          groupId: valueHuntersGroup.id,
          cashBalance: 10000,
          totalValue: 10000,
        },
      });
    }

    console.log(`✅ Created fantasy portfolios for ${allUsers.length} users`);
    console.log(`   - Tech Investors: ${allUsers.length} portfolios`);
    console.log(`   - Value Hunters: ${allUsers.length} portfolios`);

    console.log('\n✅ Seeding complete!');
    console.log(`\nUser Details:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Name: ${user.firstName} ${user.lastName}`);
    console.log(`  Learning Dollars: $${user.learningDollarsEarned}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

seedPhillipGao()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
