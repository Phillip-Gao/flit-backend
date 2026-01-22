/**
 * Test Finnhub API connection
 * Usage: npx ts-node scripts/test-finnhub.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { finnhubService } from '../src/services/finnhub';

async function testFinnhub() {
  console.log('🧪 Testing Finnhub API Connection...\n');

  // Test connection
  const isConnected = await finnhubService.testConnection();
  
  if (!isConnected) {
    console.log('❌ Failed to connect to Finnhub API');
    console.log('Please check your FINNHUB_API_KEY in .env file\n');
    process.exit(1);
  }

  console.log('✅ Finnhub API connection successful!\n');

  // Test fetching AAPL quote
  console.log('📊 Fetching AAPL quote...');
  const aaplQuote = await finnhubService.getQuote('AAPL');
  
  if (aaplQuote) {
    console.log(`
Ticker:         ${aaplQuote.ticker}
Current Price:  $${aaplQuote.currentPrice.toFixed(2)}
Previous Close: $${aaplQuote.previousClose.toFixed(2)}
Change:         $${aaplQuote.change.toFixed(2)} (${aaplQuote.changePercent >= 0 ? '+' : ''}${aaplQuote.changePercent.toFixed(2)}%)
Updated:        ${aaplQuote.timestamp.toLocaleString()}
    `);
  } else {
    console.log('❌ Failed to fetch AAPL quote\n');
  }

  console.log('✅ Test complete!');
}

testFinnhub().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
