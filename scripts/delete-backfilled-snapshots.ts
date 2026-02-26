import prisma from '../src/services/prisma';

/**
 * Delete all backfilled snapshots from the time range
 */
async function deleteBackfilledSnapshots() {
  try {
    console.log('🗑️  Deleting backfilled snapshots...\n');

    // Delete snapshots from 4 PM yesterday to 5 PM yesterday + 9 AM today to 3 PM today
    const deleteStart = new Date('2026-02-25T21:00:00.000Z'); // 4:00 PM EST yesterday
    const deleteEnd = new Date('2026-02-26T20:00:00.000Z');   // 3:00 PM EST today

    const result = await prisma.fantasyPortfolioSnapshot.deleteMany({
      where: {
        date: {
          gte: deleteStart,
          lte: deleteEnd
        }
      }
    });

    console.log(`✅ Deleted ${result.count} snapshots`);
    console.log(`📅 Time range: ${deleteStart.toISOString()} to ${deleteEnd.toISOString()}`);

  } catch (error) {
    console.error('❌ Error deleting snapshots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteBackfilledSnapshots();
