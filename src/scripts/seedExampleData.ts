import prisma from '../services/prisma';

async function seedExampleData() {
  try {
    console.log('🌱 Seeding example leagues and portfolios...');

    // Create or get the example user
    const user = await prisma.user.upsert({
      where: { id: 'user_1' },
      update: {},
      create: {
        id: 'user_1',
        username: 'demo_user',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        completedLessons: [],
      },
    });

    console.log('✅ User created/found:', user.username);

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

    // Create example leagues
    const leaguesData = [
      {
        id: 'league-example-1',
        name: 'Economics 101',
        adminUserId: user.id,
        settings: {
          leagueSize: 28,
          startingBalance: 10000,
          competitionPeriod: '3_months',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Started 30 days ago
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 10,
          allowShortSelling: false,
          tradingEnabled: true,
        },
        portfolioData: {
          cashBalance: 2450.00,
          holdings: [
            { ticker: 'AAPL', shares: 5, averageCost: 170.50 },
            { ticker: 'MSFT', shares: 3, averageCost: 365.00 },
            { ticker: 'NVDA', shares: 2, averageCost: 455.00 },
          ],
        },
      },
      {
        id: 'league-example-2',
        name: 'College Friends',
        adminUserId: user.id,
        settings: {
          leagueSize: 7,
          startingBalance: 10000,
          competitionPeriod: '1_month',
          startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // Started 15 days ago
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock', 'ETF'],
          minAssetPrice: 10,
          allowShortSelling: false,
          tradingEnabled: true,
        },
        portfolioData: {
          cashBalance: 1200.00,
          holdings: [
            { ticker: 'TSLA', shares: 4, averageCost: 250.00 },
            { ticker: 'AMZN', shares: 3, averageCost: 148.00 },
          ],
        },
      },
      {
        id: 'league-example-3',
        name: 'Tech Stocks Challenge',
        adminUserId: user.id,
        settings: {
          leagueSize: 15,
          startingBalance: 15000,
          competitionPeriod: '6_months',
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // Started 60 days ago
          scoringMethod: 'Total Return %',
          enabledAssetClasses: ['Stock'],
          minAssetPrice: 50,
          allowShortSelling: false,
          tradingEnabled: true,
        },
        portfolioData: {
          cashBalance: 3500.00,
          holdings: [
            { ticker: 'AAPL', shares: 8, averageCost: 175.00 },
            { ticker: 'GOOGL', shares: 10, averageCost: 135.00 },
            { ticker: 'META', shares: 4, averageCost: 320.00 },
            { ticker: 'V', shares: 6, averageCost: 245.00 },
          ],
        },
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

      // Check if membership already exists
      const existingMembership = await prisma.leagueMembership.findFirst({
        where: {
          leagueId: league.id,
          userId: user.id,
        },
      });

      if (!existingMembership) {
        // Create league membership
        await prisma.leagueMembership.create({
          data: {
            leagueId: league.id,
            userId: user.id,
          },
        });
      }

      // Create or update portfolio for this league
      const portfolio = await prisma.fantasyPortfolio.upsert({
        where: {
          leagueId_userId: {
            leagueId: league.id,
            userId: user.id,
          },
        },
        update: {
          cashBalance: leagueData.portfolioData.cashBalance,
        },
        create: {
          leagueId: league.id,
          userId: user.id,
          cashBalance: leagueData.portfolioData.cashBalance,
        },
      });

      console.log(`  ✅ Portfolio created/updated for league: ${league.name}`);

      // Delete existing slots for this portfolio
      await prisma.portfolioSlot.deleteMany({
        where: { portfolioId: portfolio.id },
      });

      // Create portfolio slots (holdings)
      for (const holding of leagueData.portfolioData.holdings) {
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

      console.log(`  ✅ Holdings created for ${league.name}`);
    }

    console.log('\n🎉 Example data seeded successfully!');
    console.log('\nCreated:');
    console.log('  - 1 user (user_1)');
    console.log('  - 8 assets (AAPL, MSFT, NVDA, TSLA, AMZN, GOOGL, META, V)');
    console.log('  - 3 leagues with portfolios');
    console.log('\nYou can now view these in the app!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedExampleData();
