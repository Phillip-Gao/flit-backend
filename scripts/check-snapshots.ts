import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSnapshots() {
  const snapshots = await prisma.fantasyPortfolioSnapshot.findMany({
    where: {
      timestamp: {
        gte: new Date('2026-02-25T16:00:00.000Z'),
        lte: new Date('2026-02-26T15:00:00.000Z')
      }
    },
    orderBy: { timestamp: 'asc' },
    take: 20,
    select: {
      timestamp: true,
      sp500Value: true,
    }
  });
  
  console.log('📊 Sample S&P 500 values from 4pm yesterday to 3pm today:\n');
  snapshots.forEach(s => {
    const time = new Date(s.timestamp).toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      month: 'numeric',
      day: 'numeric'
    });
    console.log(`${time} - $${Number(s.sp500Value).toFixed(2)}`);
  });
  
  // Check if all values are the same
  const uniqueValues = new Set(snapshots.map(s => Number(s.sp500Value)));
  console.log(`\n📈 Unique S&P 500 values: ${uniqueValues.size}`);
  if (uniqueValues.size === 1) {
    console.log('⚠️  WARNING: All S&P 500 values are identical! This is not realistic.');
  }
  
  await prisma.$disconnect();
}

checkSnapshots();
