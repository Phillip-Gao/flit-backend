import prisma from '../services/prisma';

async function clearLeagues() {
  try {
    console.log('Clearing all leagues and related data...');

    // Delete in order of foreign key dependencies
    await prisma.fantasyPortfolioTransaction.deleteMany({});
    await prisma.portfolioSlot.deleteMany({});
    await prisma.fantasyPortfolio.deleteMany({});
    await prisma.draftPick.deleteMany({});
    await prisma.draftState.deleteMany({});
    await prisma.matchup.deleteMany({});
    await prisma.trade.deleteMany({});
    await prisma.waiverClaim.deleteMany({});
    await prisma.leagueMembership.deleteMany({});
    await prisma.league.deleteMany({});

    console.log('✅ All leagues and related data cleared successfully!');
  } catch (error) {
    console.error('Error clearing leagues:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearLeagues();
