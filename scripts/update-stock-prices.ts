/**
 * Script to manually update stock prices from Finnhub
 * Usage: npx ts-node scripts/update-stock-prices.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { stockPriceUpdater } from '../src/services/stockPriceUpdater';
import prisma from '../src/services/prisma';

async function main() {
  try {
    console.log('🚀 Updating stock prices from Finnhub...\n');

    await stockPriceUpdater.updateAllStockPrices();

    console.log('\n✅ Price update complete!');
  } catch (error) {
    console.error('\n❌ Error updating prices:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
