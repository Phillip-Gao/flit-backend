import prisma from '../src/services/prisma';

/**
 * Delete ALL portfolio snapshots to allow fresh baseline calculation
 */
async function clearSnapshots() {
  try {
    console.log('🗑️  Clearing all portfolio snapshots...\n');

    const result = await prisma.fantasyPortfolioSnapshot.deleteMany({});

    console.log(`✅ Deleted ${result.count} snapshots`);
    console.log('📸 Fresh snapshots will be created on next hourly update with correct S&P 500 baseline');

  } catch (error) {
    console.error('❌ Error clearing snapshots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearSnapshots();
