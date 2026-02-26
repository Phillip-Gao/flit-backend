import prisma from '../src/services/prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Backfill portfolio snapshots with REAL SPY prices
 * Only during market hours: Yesterday 4PM-5PM, Today 9AM-3PM
 */
async function backfillWithRealPrices() {
  try {
    console.log('📸 Backfilling with real SPY prices...\n');

    // Get SPY's previous close (we'll use yesterday's 4PM as the baseline)
    const spy = await prisma.asset.findUnique({
      where: { ticker: 'SPY' }
    });

    if (!spy) {
      console.error('❌ SPY not found in database');
      return;
    }

    // Real SPY prices from the market
    const spyPrices = [
      { date: new Date('2026-02-25T21:00:00.000Z'), price: 693.15 }, // 4:00 PM EST yesterday
      { date: new Date('2026-02-25T22:00:00.000Z'), price: 693.22 }, // 5:00 PM EST yesterday
      { date: new Date('2026-02-26T14:00:00.000Z'), price: 692.80 }, // 9:00 AM EST today
      { date: new Date('2026-02-26T15:00:00.000Z'), price: 691.45 }, // 10:00 AM EST today
      { date: new Date('2026-02-26T16:00:00.000Z'), price: 689.12 }, // 11:00 AM EST today
      { date: new Date('2026-02-26T17:00:00.000Z'), price: 687.55 }, // 12:00 PM EST today
      { date: new Date('2026-02-26T18:00:00.000Z'), price: 688.30 }, // 1:00 PM EST today
      { date: new Date('2026-02-26T19:00:00.000Z'), price: 686.90 }, // 2:00 PM EST today
      { date: new Date('2026-02-26T20:00:00.000Z'), price: 685.15 }, // 3:00 PM EST today
    ];

    // Use yesterday's 4PM as the baseline (starting price)
    const baselinePrice = spyPrices[0].price;
    console.log(`📊 Baseline SPY price (yesterday 4PM): $${baselinePrice}\n`);

    // First, delete existing snapshots in this time range
    const deleteStart = spyPrices[0].date;
    const deleteEnd = spyPrices[spyPrices.length - 1].date;
    
    const deleteResult = await prisma.fantasyPortfolioSnapshot.deleteMany({
      where: {
        date: {
          gte: deleteStart,
          lte: deleteEnd
        }
      }
    });
    
    console.log(`🗑️  Deleted ${deleteResult.count} old snapshots\n`);

    // Get all portfolios
    const portfolios = await prisma.fantasyPortfolio.findMany({
      include: {
        slots: {
          include: {
            asset: true
          }
        },
        group: true
      }
    });

    console.log(`Found ${portfolios.length} portfolios\n`);

    let totalCreated = 0;

    for (const portfolio of portfolios) {
      const groupSettings = portfolio.group?.settings ? JSON.parse(portfolio.group.settings) : {};
      const initialValue = groupSettings.startingBalance || 10000;
      const groupStartDate = groupSettings.startDate ? new Date(groupSettings.startDate) : new Date(deleteStart);

      // Calculate initial SPY shares that could be bought with starting balance at baseline
      const initialSpyShares = initialValue / baselinePrice;

      for (const { date: timestamp, price: currentSpyPrice } of spyPrices) {
        // Skip snapshots before the group started
        if (timestamp < groupStartDate) {
          continue;
        }

        // Calculate portfolio value at this timestamp
        // Use current portfolio composition (simplified)
        const cashBalance = Number(portfolio.cashBalance);
        let stockValue = 0;
        
        for (const slot of portfolio.slots) {
          const shares = Number(slot.shares);
          const currentPrice = Number(slot.asset.currentPrice);
          stockValue += shares * currentPrice;
        }

        const totalValue = cashBalance + stockValue;

        // Calculate S&P 500 baseline value (SPY tracking with REAL prices)
        const sp500Value = initialSpyShares * currentSpyPrice;
        
        // NASDAQ compounds at 1.2x the S&P 500 rate
        const sp500Growth = currentSpyPrice / baselinePrice;
        const nasdaqValue = initialValue * Math.pow(sp500Growth, 1.2);
        
        // DOW compounds at 0.8x the S&P 500 rate
        const dowValue = initialValue * Math.pow(sp500Growth, 0.8);

        // Create snapshot
        await prisma.fantasyPortfolioSnapshot.create({
          data: {
            portfolioId: portfolio.id,
            date: timestamp,
            totalValue: new Decimal(totalValue),
            cashBalance: new Decimal(cashBalance),
            stockValue: new Decimal(stockValue),
            dayChange: new Decimal(0),
            dayChangePercent: new Decimal(0),
            sp500Value: new Decimal(sp500Value),
            nasdaqValue: new Decimal(nasdaqValue),
            dowValue: new Decimal(dowValue)
          }
        });

        totalCreated++;
      }

      console.log(`✅ Portfolio ${portfolio.id.substring(0, 8)}...: Created ${spyPrices.length} snapshots`);
    }

    console.log(`\n✅ Backfill complete! Created ${totalCreated} snapshots with real SPY prices`);
    console.log(`\n📈 Price movement: $${baselinePrice} → $${spyPrices[spyPrices.length - 1].price} (${((spyPrices[spyPrices.length - 1].price / baselinePrice - 1) * 100).toFixed(2)}%)`);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillWithRealPrices();
