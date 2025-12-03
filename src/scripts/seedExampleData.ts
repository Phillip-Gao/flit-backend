import prisma from '../services/prisma';

async function seedExampleData() {
  try {
    console.log('🌱 Seeding example leagues and portfolios...');

    // Create multiple users
    const usersData = [
      { id: 'user_1', username: 'phillip', email: 'phillip@example.com', firstName: 'Phillip', lastName: 'Gao' },
      { id: 'user_2', username: 'sarah_chen', email: 'sarah@example.com', firstName: 'Sarah', lastName: 'Chen' },
      { id: 'user_3', username: 'mike_ross', email: 'mike@example.com', firstName: 'Mike', lastName: 'Ross' },
      { id: 'user_4', username: 'emily_wong', email: 'emily@example.com', firstName: 'Emily', lastName: 'Wong' },
      { id: 'user_5', username: 'david_kim', email: 'david@example.com', firstName: 'David', lastName: 'Kim' },
      { id: 'user_6', username: 'jessica_lee', email: 'jessica@example.com', firstName: 'Jessica', lastName: 'Lee' },
      { id: 'user_7', username: 'ryan_park', email: 'ryan@example.com', firstName: 'Ryan', lastName: 'Park' },
      { id: 'user_8', username: 'amanda_liu', email: 'amanda@example.com', firstName: 'Amanda', lastName: 'Liu' },
    ];

    const users = [];
    for (const userData of usersData) {
      const user = await prisma.user.upsert({
        where: { id: userData.id },
        update: {
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
        create: {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          completedLessons: [],
        },
      });
      users.push(user);
      console.log(`✅ User created/found: ${user.username}`);
    }

    // Create example assets if they don't exist
    const assets = [
      { ticker: 'AAPL', name: 'Apple Inc.', type: 'Stock' as const, tier: 'Tier 1' as const, currentPrice: 178.32, previousClose: 176.15 },
      { ticker: 'MSFT', name: 'Microsoft Corporation', type: 'Stock' as const, tier: 'Tier 1' as const, currentPrice: 378.91, previousClose: 375.65 },
      { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'Stock' as const, tier: 'Tier 1' as const, currentPrice: 495.22, previousClose: 478.90 },
      { ticker: 'TSLA', name: 'Tesla Inc.', type: 'Stock' as const, tier: 'Tier 2' as const, currentPrice: 242.84, previousClose: 247.20 },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'Stock' as const, tier: 'Tier 1' as const, currentPrice: 155.67, previousClose: 152.40 },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'Stock' as const, tier: 'Tier 1' as const, currentPrice: 140.25, previousClose: 140.88 },
      { ticker: 'META', name: 'Meta Platforms Inc.', type: 'Stock' as const, tier: 'Tier 1' as const, currentPrice: 338.54, previousClose: 335.46 },
      { ticker: 'V', name: 'Visa Inc.', type: 'Stock' as const, tier: 'Tier 2' as const, currentPrice: 252.89, previousClose: 251.20 },
    ];

    for (const assetData of assets) {
      await prisma.asset.upsert({
        where: { ticker: assetData.ticker },
        update: {
          currentPrice: assetData.currentPrice,
          previousClose: assetData.previousClose,
        },
        create: {
          ticker: assetData.ticker,
          name: assetData.name,
          type: assetData.type,
          tier: assetData.tier,
          currentPrice: assetData.currentPrice,
          previousClose: assetData.previousClose,
          isActive: true,
          requiredLessons: [],
        },
      });
    }

    console.log('✅ Assets created/updated');

    // Create example leagues with multiple members
    const leaguesData = [
      {
        id: 'league-example-1',
        name: 'Economics 101',
        adminUserId: users[0].id, // Phillip
        settings: {
          leagueSize: 28,
          startingBalance: 10000,
          competitionPeriod: '3_months',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 10,
          allowShortSelling: false,
          tradingEnabled: true,
        },
        members: [
          { userId: users[0].id, cashBalance: 2450.00, holdings: [
            { ticker: 'AAPL', shares: 5, averageCost: 170.50 },
            { ticker: 'MSFT', shares: 3, averageCost: 365.00 },
            { ticker: 'NVDA', shares: 2, averageCost: 455.00 },
          ]},
          { userId: users[1].id, cashBalance: 3200.00, holdings: [
            { ticker: 'GOOGL', shares: 12, averageCost: 138.00 },
            { ticker: 'META', shares: 4, averageCost: 330.00 },
          ]},
          { userId: users[2].id, cashBalance: 1800.00, holdings: [
            { ticker: 'AAPL', shares: 10, averageCost: 172.00 },
            { ticker: 'TSLA', shares: 3, averageCost: 245.00 },
            { ticker: 'V', shares: 5, averageCost: 248.00 },
          ]},
          { userId: users[3].id, cashBalance: 4100.00, holdings: [
            { ticker: 'MSFT', shares: 5, averageCost: 370.00 },
            { ticker: 'AMZN', shares: 6, averageCost: 150.00 },
          ]},
          { userId: users[4].id, cashBalance: 2900.00, holdings: [
            { ticker: 'NVDA', shares: 3, averageCost: 480.00 },
            { ticker: 'AAPL', shares: 8, averageCost: 175.00 },
            { ticker: 'GOOGL', shares: 5, averageCost: 142.00 },
          ]},
        ],
      },
      {
        id: 'league-example-2',
        name: 'College Friends',
        adminUserId: users[0].id, // Phillip
        settings: {
          leagueSize: 7,
          startingBalance: 10000,
          competitionPeriod: '1_month',
          startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 10,
          allowShortSelling: false,
          tradingEnabled: true,
        },
        members: [
          { userId: users[0].id, cashBalance: 1200.00, holdings: [
            { ticker: 'TSLA', shares: 4, averageCost: 250.00 },
            { ticker: 'AMZN', shares: 3, averageCost: 148.00 },
          ]},
          { userId: users[5].id, cashBalance: 2500.00, holdings: [
            { ticker: 'AAPL', shares: 7, averageCost: 176.00 },
            { ticker: 'V', shares: 4, averageCost: 250.00 },
          ]},
          { userId: users[6].id, cashBalance: 3800.00, holdings: [
            { ticker: 'NVDA', shares: 2, averageCost: 490.00 },
            { ticker: 'META', shares: 3, averageCost: 335.00 },
          ]},
          { userId: users[7].id, cashBalance: 1600.00, holdings: [
            { ticker: 'GOOGL', shares: 15, averageCost: 139.00 },
            { ticker: 'MSFT', shares: 2, averageCost: 375.00 },
          ]},
        ],
      },
      {
        id: 'league-example-3',
        name: 'Tech Stocks Challenge',
        adminUserId: users[0].id, // Phillip
        settings: {
          leagueSize: 15,
          startingBalance: 15000,
          competitionPeriod: '6_months',
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock'],
          minAssetPrice: 50,
          allowShortSelling: false,
          tradingEnabled: true,
        },
        members: [
          { userId: users[0].id, cashBalance: 3500.00, holdings: [
            { ticker: 'AAPL', shares: 8, averageCost: 175.00 },
            { ticker: 'GOOGL', shares: 10, averageCost: 135.00 },
            { ticker: 'META', shares: 4, averageCost: 320.00 },
            { ticker: 'V', shares: 6, averageCost: 245.00 },
          ]},
          { userId: users[1].id, cashBalance: 2100.00, holdings: [
            { ticker: 'NVDA', shares: 5, averageCost: 475.00 },
            { ticker: 'MSFT', shares: 6, averageCost: 372.00 },
            { ticker: 'AAPL', shares: 4, averageCost: 178.00 },
          ]},
          { userId: users[2].id, cashBalance: 4200.00, holdings: [
            { ticker: 'META', shares: 6, averageCost: 325.00 },
            { ticker: 'GOOGL', shares: 12, averageCost: 137.00 },
            { ticker: 'V', shares: 8, averageCost: 247.00 },
          ]},
          { userId: users[3].id, cashBalance: 1900.00, holdings: [
            { ticker: 'AAPL', shares: 15, averageCost: 173.00 },
            { ticker: 'MSFT', shares: 8, averageCost: 368.00 },
            { ticker: 'NVDA', shares: 3, averageCost: 485.00 },
          ]},
          { userId: users[4].id, cashBalance: 5300.00, holdings: [
            { ticker: 'GOOGL', shares: 18, averageCost: 136.00 },
            { ticker: 'META', shares: 5, averageCost: 318.00 },
          ]},
          { userId: users[5].id, cashBalance: 2800.00, holdings: [
            { ticker: 'NVDA', shares: 4, averageCost: 478.00 },
            { ticker: 'AAPL', shares: 10, averageCost: 176.00 },
            { ticker: 'V', shares: 7, averageCost: 246.00 },
          ]},
        ],
      },
    ];

    for (const leagueData of leaguesData) {
      // Create or update league
      const league = await prisma.league.upsert({
        where: { id: leagueData.id },
        update: {
          name: leagueData.name,
          settings: JSON.stringify(leagueData.settings),
        },
        create: {
          id: leagueData.id,
          name: leagueData.name,
          adminUserId: leagueData.adminUserId,
          type: 'custom',
          settings: JSON.stringify(leagueData.settings),
          joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          criteria: JSON.stringify({}),
        },
      });

      console.log(`✅ League created/updated: ${league.name}`);

      // Add all members to the league
      for (const memberData of leagueData.members) {
        // Check if membership already exists
        const existingMembership = await prisma.leagueMembership.findFirst({
          where: {
            leagueId: league.id,
            userId: memberData.userId,
          },
        });

        if (!existingMembership) {
          await prisma.leagueMembership.create({
            data: {
              leagueId: league.id,
              userId: memberData.userId,
            },
          });
        }

        // Create or update portfolio for this member
        const portfolio = await prisma.fantasyPortfolio.upsert({
          where: {
            leagueId_userId: {
              leagueId: league.id,
              userId: memberData.userId,
            },
          },
          update: {
            cashBalance: memberData.cashBalance,
          },
          create: {
            leagueId: league.id,
            userId: memberData.userId,
            cashBalance: memberData.cashBalance,
          },
        });

        // Delete existing slots for this portfolio
        await prisma.portfolioSlot.deleteMany({
          where: { portfolioId: portfolio.id },
        });

        // Create portfolio slots (holdings)
        for (const holding of memberData.holdings) {
          const asset = await prisma.asset.findUnique({
            where: { ticker: holding.ticker },
          });

          if (asset) {
            await prisma.portfolioSlot.create({
              data: {
                portfolioId: portfolio.id,
                assetId: asset.id,
                shares: holding.shares,
                averageCost: holding.averageCost,
                currentPrice: parseFloat(asset.currentPrice.toString()),
              },
            });
          }
        }

        const user = users.find(u => u.id === memberData.userId);
        console.log(`  ✅ Portfolio created for ${user?.username} in ${league.name}`);
      }

      console.log(`  📊 ${leagueData.members.length} members added to ${league.name}`);
    }

    console.log('\n🎉 Example data seeded successfully!');
    console.log('\nCreated:');
    console.log(`  - ${users.length} users`);
    console.log('  - 8 assets (AAPL, MSFT, NVDA, TSLA, AMZN, GOOGL, META, V)');
    console.log('  - 3 leagues with multiple members and portfolios');
    console.log('\nYou can now view these in the app!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedExampleData();
