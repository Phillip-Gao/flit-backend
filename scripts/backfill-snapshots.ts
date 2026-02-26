import prisma from '../src/services/prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Backfill portfolio snapshots from 4 PM yesterday to 3 PM today
 */
async function backfillSnapshots() {
  try {
    console.log('📸 Starting snapshot backfill...\n');

    // Get current SPY price for baseline calculations
    const spy = await prisma.asset.findUnique({
      where: { ticker: 'SPY' }
    });

    if (!spy) {
      console.error('❌ SPY not found in database');
      return;
    }

    const currentSpyPrice = Number(spy.currentPrice);
    const previousSpyPrice = Number(spy.previousClose);
    console.log(`SPY Current: $${currentSpyPrice}, Previous: $${previousSpyPrice}\n`);

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

    // Generate timestamps from 4 PM yesterday to 3 PM today (hourly)
    const now = new Date();
    const yesterday4PM = new Date(now);
    yesterday4PM.setDate(yesterday4PM.getDate() - 1);
    yesterday4PM.setHours(16, 0, 0, 0); // 4 PM yesterday

    const today3PM = new Date(now);
    today3PM.setHours(15, 0, 0, 0); // 3 PM today

    const timestamps: Date[] = [];
    let current = new Date(yesterday4PM);
    
    while (current <= today3PM) {
      timestamps.push(new Date(current));
      current.setHours(current.getHours() + 1);
    }

    console.log(`Generating ${timestamps.length} hourly snapshots from ${yesterday4PM.toLocaleString()} to ${today3PM.toLocaleString()}\n`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const portfolio of portfolios) {
      const groupSettings = portfolio.group?.settings ? JSON.parse(portfolio.group.settings) : {};
      const initialValue = groupSettings.startingBalance || 10000;
      const groupStartDate = groupSettings.startDate ? new Date(groupSettings.startDate) : new Date(yesterday4PM);

      // Calculate initial SPY shares that could be bought with starting balance
      const initialSpyShares = initialValue / previousSpyPrice;

      for (const timestamp of timestamps) {
        // Skip snapshots before the group started
        if (timestamp < groupStartDate) {
          continue;
        }

        // Check if snapshot already exists
        const existing = await prisma.fantasyPortfolioSnapshot.findUnique({
          where: {
            portfolioId_date: {
              portfolioId: portfolio.id,
              date: timestamp
            }
          }
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Calculate portfolio value at this timestamp
        // For simplification, we'll use current portfolio composition
        const cashBalance = Number(portfolio.cashBalance);
        let stockValue = 0;
        
        for (const slot of portfolio.slots) {
          const shares = Number(slot.shares);
          const currentPrice = Number(slot.asset.currentPrice);
          stockValue += shares * currentPrice;
        }

        const totalValue = cashBalance + stockValue;

        // Calculate S&P 500 baseline value (SPY tracking)
        const sp500Value = initialSpyShares * currentSpyPrice;
        
        // NASDAQ compounds at 1.2x the S&P 500 rate
        const sp500Growth = currentSpyPrice / previousSpyPrice;
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

      console.log(`✅ Portfolio ${portfolio.id}: Created ${totalCreated - totalSkipped} snapshots`);
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Created: ${totalCreated} snapshots`);
    console.log(`   Skipped: ${totalSkipped} (already existed)`);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillSnapshots();
