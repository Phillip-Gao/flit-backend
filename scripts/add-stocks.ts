import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addStockHoldings() {
  console.log('🌱 Adding stock holdings to portfolios...');
  
  // Create sample assets
  const assets = await Promise.all([
    prisma.asset.upsert({
      where: { ticker: 'AAPL' },
      update: {},
      create: {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'Stock',
        tier: 'Tier 1',
        currentPrice: 175.50,
        previousClose: 173.00,
        sector: 'Technology',
      },
    }),
    prisma.asset.upsert({
      where: { ticker: 'GOOGL' },
      update: {},
      create: {
        ticker: 'GOOGL',
        name: 'Alphabet Inc.',
        type: 'Stock',
        tier: 'Tier 1',
        currentPrice: 140.25,
        previousClose: 138.00,
        sector: 'Technology',
      },
    }),
    prisma.asset.upsert({
      where: { ticker: 'MSFT' },
      update: {},
      create: {
        ticker: 'MSFT',
        name: 'Microsoft Corporation',
        type: 'Stock',
        tier: 'Tier 1',
        currentPrice: 380.00,
        previousClose: 375.00,
        sector: 'Technology',
      },
    }),
    prisma.asset.upsert({
      where: { ticker: 'TSLA' },
      update: {},
      create: {
        ticker: 'TSLA',
        name: 'Tesla Inc.',
        type: 'Stock',
        tier: 'Tier 2',
        currentPrice: 245.30,
        previousClose: 240.00,
        sector: 'Automotive',
      },
    }),
    prisma.asset.upsert({
      where: { ticker: 'AMZN' },
      update: {},
      create: {
        ticker: 'AMZN',
        name: 'Amazon.com Inc.',
        type: 'Stock',
        tier: 'Tier 1',
        currentPrice: 155.80,
        previousClose: 154.00,
        sector: 'Consumer',
      },
    }),
  ]);
  
  console.log(`✅ Created/verified ${assets.length} assets`);
  
  // Add portfolio slots for each portfolio
  const portfolios = await prisma.fantasyPortfolio.findMany();
  
  for (const portfolio of portfolios) {
    // Clear existing slots
    await prisma.portfolioSlot.deleteMany({ where: { portfolioId: portfolio.id } });
    
    // Add 2-3 random stocks to each portfolio
    const numStocks = 2 + Math.floor(Math.random() * 2);
    const shuffledAssets = [...assets].sort(() => 0.5 - Math.random());
    const selectedAssets = shuffledAssets.slice(0, numStocks);
    
    for (const asset of selectedAssets) {
      const shares = Math.floor(Math.random() * 20) + 10;
      const avgCostNum = Number(asset.currentPrice) * (0.85 + Math.random() * 0.3);
      
      await prisma.portfolioSlot.create({
        data: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          shares,
          averageCost: avgCostNum,
          currentPrice: Number(asset.currentPrice),
        },
      });
    }
    
    // Update portfolio total value
    const slots = await prisma.portfolioSlot.findMany({
      where: { portfolioId: portfolio.id },
      include: { asset: true },
    });
    
    const totalStockValue = slots.reduce((sum, slot) => sum + (Number(slot.shares) * Number(slot.asset.currentPrice)), 0);
    const newTotalValue = Number(portfolio.cashBalance) + totalStockValue;
    
    await prisma.fantasyPortfolio.update({
      where: { id: portfolio.id },
      data: { totalValue: newTotalValue },
    });
    
    console.log(`Updated portfolio: $${newTotalValue.toFixed(2)}`);
  }
  
  console.log('✅ Done adding stock holdings!');
  await prisma.$disconnect();
}

addStockHoldings().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
