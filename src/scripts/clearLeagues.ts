import prisma from '../services/prisma';
import { execSync } from 'child_process';
import path from 'path';

async function clearLeagues() {
  try {
    console.log('🗑️  Clearing all leagues and related data...');

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
    console.log('');

    // Run seed script to repopulate with example data
    console.log('🌱 Running seed script to create example data...');
    const seedScriptPath = path.join(__dirname, 'seedExampleData.ts');
    execSync(`npx ts-node ${seedScriptPath}`, { stdio: 'inherit' });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearLeagues();
