import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for SPY asset...');
  
  // Upsert SPY - create if doesn't exist, update if it does
  const spy = await prisma.asset.upsert({
    where: { ticker: 'SPY' },
    update: {
      name: 'SPDR S&P 500 ETF Trust',
      type: 'ETF',
      tier: 'Tier 1',
      isActive: true,
    },
    create: {
      ticker: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      type: 'ETF',
      tier: 'Tier 1',
      currentPrice: new Decimal(520.00), // Approximate current price
      previousClose: new Decimal(518.50), // Yesterday's close
      marketCap: new Decimal(500000000000), // ~$500B market cap
      isActive: true,
      requiredLessons: [],
    }
  });
  
  console.log('✅ SPY asset ready:', {
    ticker: spy.ticker,
    type: spy.type,
    currentPrice: spy.currentPrice.toString(),
    previousClose: spy.previousClose.toString(),
    updatedAt: spy.updatedAt.toISOString()
  });
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
