import prisma from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Service for managing hourly portfolio snapshots and market baseline comparisons
 */
export class PortfolioSnapshotService {
  /**
   * Take hourly snapshots of all portfolios
   * Call this every hour via cron job after stock prices are updated
   */
  async takeDailySnapshots(): Promise<void> {
    try {
      const snapshotTime = this.getCurrentHourTimestamp();
      console.log(`📸 Taking portfolio snapshots for ${snapshotTime.toISOString()} (hour: ${snapshotTime.getHours()}:00)...`);

      // Get all portfolios with their current values
      const portfolios = await prisma.fantasyPortfolio.findMany({
        include: {
          slots: {
            include: {
              asset: true,
            },
          },
          group: true,
        },
      });

      let snapshotCount = 0;

      for (const portfolio of portfolios) {
        console.log(`  📊 Processing portfolio ${portfolio.id} (User: ${portfolio.userId})`);

        // Calculate current values
        const cashBalance = Number(portfolio.cashBalance);
        const stockValue = portfolio.slots.reduce((sum, slot) => {
          const slotValue = Number(slot.shares) * Number(slot.asset.currentPrice);
          console.log(`    ${slot.asset.ticker}: ${slot.shares} shares @ $${Number(slot.asset.currentPrice).toFixed(2)} = $${slotValue.toFixed(2)}`);
          return sum + slotValue;
        }, 0);
        const totalValue = cashBalance + stockValue;
        console.log(`    Cash: $${cashBalance.toFixed(2)}, Stock: $${stockValue.toFixed(2)}, Total: $${totalValue.toFixed(2)}`);

        // Get previous day's snapshot for change calculation
        const previousSnapshot = await prisma.fantasyPortfolioSnapshot.findFirst({
          where: { portfolioId: portfolio.id },
          orderBy: { date: 'desc' },
        });

        const dayChange = previousSnapshot 
          ? totalValue - Number(previousSnapshot.totalValue)
          : 0;
        const dayChangePercent = previousSnapshot && Number(previousSnapshot.totalValue) > 0
          ? (dayChange / Number(previousSnapshot.totalValue)) * 100
          : 0;

        // Calculate baseline values (what initial cash would be worth in each index)
        // Use group's baseline SPY price so all portfolios in the same group have the same S&P 500 baseline
        const initialValue = Number(portfolio.initialValue);
        const groupSettings = portfolio.group?.settings ? JSON.parse(portfolio.group.settings) : {};
        const groupStartDate = groupSettings.startDate ? new Date(groupSettings.startDate) : portfolio.createdAt;
        
        const baselines = await this.calculateBaselineValues(
          portfolio.id,
          portfolio.groupId,
          initialValue,
          groupStartDate,
          snapshotTime
        );

        // Upsert snapshot (create new or update existing for the same hour)
        await prisma.fantasyPortfolioSnapshot.upsert({
          where: {
            portfolioId_date: {
              portfolioId: portfolio.id,
              date: snapshotTime,
            },
          },
          update: {
            totalValue: new Decimal(totalValue),
            cashBalance: new Decimal(cashBalance),
            stockValue: new Decimal(stockValue),
            dayChange: new Decimal(dayChange),
            dayChangePercent: new Decimal(dayChangePercent),
            sp500Value: new Decimal(baselines.sp500),
            nasdaqValue: new Decimal(baselines.nasdaq),
            dowValue: new Decimal(baselines.dow),
          },
          create: {
            portfolioId: portfolio.id,
            date: snapshotTime,
            totalValue: new Decimal(totalValue),
            cashBalance: new Decimal(cashBalance),
            stockValue: new Decimal(stockValue),
            dayChange: new Decimal(dayChange),
            dayChangePercent: new Decimal(dayChangePercent),
            sp500Value: new Decimal(baselines.sp500),
            nasdaqValue: new Decimal(baselines.nasdaq),
            dowValue: new Decimal(baselines.dow),
          },
        });

        console.log(`    ✅ Snapshot saved for portfolio ${portfolio.id}`);
        snapshotCount++;
      }

      console.log(`✅ Processed ${snapshotCount} portfolio snapshots (created or updated)`);
    } catch (error) {
      console.error('❌ Error taking hourly snapshots:', error);
      throw error;
    }
  }

  /**
   * Get current hour timestamp (truncated to the hour)
   * Returns datetime at the start of the current hour (e.g., 14:00:00)
   */
  private getCurrentHourTimestamp(): Date {
    const now = new Date();
    const hourTimestamp = new Date(now);
    hourTimestamp.setMinutes(0, 0, 0); // Set to start of current hour
    return hourTimestamp;
  }

  /**
   * Calculate what the initial portfolio value would be worth if invested in S&P 500 (SPY)
   * Uses actual SPY price data from the Asset table
   * Baseline is established from the earliest recorded snapshot timestamp for any portfolio in the group
   * @param groupStartDate - The group's start date (all portfolios in group use same baseline)
   */
  private async calculateBaselineValues(
    portfolioId: string,
    groupId: string,
    initialValue: number,
    groupStartDate: Date,
    currentDate: Date
  ): Promise<{ sp500: number; nasdaq: number; dow: number }> {
    // Get SPY (S&P 500 ETF) current price
    const spy = await prisma.asset.findUnique({
      where: { ticker: 'SPY' },
      select: {
        currentPrice: true,
        previousClose: true,
      }
    });

    if (!spy) {
      console.warn('⚠️  SPY not found in Asset table - using flat baseline');
      // Fallback to flat baseline if SPY isn't available
      return {
        sp500: initialValue,
        nasdaq: initialValue,
        dow: initialValue,
      };
    }

    // Keep one fixed SPY baseline per group so hourly snapshots can produce
    // consistent percentage moves over time.
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { settings: true },
    });
    const settings = group?.settings ? JSON.parse(group.settings) : {};
    let baselineSpyPrice = Number(settings.baselineSpyPrice);

    if (!Number.isFinite(baselineSpyPrice) || baselineSpyPrice <= 0) {
      baselineSpyPrice = Number(spy.previousClose);
      if (!Number.isFinite(baselineSpyPrice) || baselineSpyPrice <= 0) {
        baselineSpyPrice = Number(spy.currentPrice);
      }
      if (!Number.isFinite(baselineSpyPrice) || baselineSpyPrice <= 0) {
        baselineSpyPrice = 1;
      }

      const nextSettings = {
        ...settings,
        baselineSpyPrice,
        baselineSetAt: new Date().toISOString(),
      };
      await prisma.group.update({
        where: { id: groupId },
        data: { settings: JSON.stringify(nextSettings) },
      });
      console.log(`  📍 Established group SPY baseline: $${baselineSpyPrice.toFixed(2)}`);
    }
    
    // Calculate how many SPY shares could be bought with initial value at baseline price
    const shares = initialValue / baselineSpyPrice;
    
    // Calculate current value of those shares
    const currentSpyPrice = Number(spy.currentPrice);
    const sp500Value = shares * currentSpyPrice;

    // For NASDAQ and DOW, use proportional growth rates
    // NASDAQ typically outperforms (~20% more volatile)
    // DOW typically underperforms slightly (~20% less volatile)
    const sp500Growth = sp500Value / initialValue;
    const nasdaqValue = initialValue * Math.pow(sp500Growth, 1.2);
    const dowValue = initialValue * Math.pow(sp500Growth, 0.8);

    return {
      sp500: sp500Value,
      nasdaq: nasdaqValue,
      dow: dowValue,
    };
  }

  /**
   * Get current market index prices
   */
  private async getMarketIndices(): Promise<{
    spy?: MarketIndexData;
    qqq?: MarketIndexData;
    dia?: MarketIndexData;
  }> {
    const indices = await prisma.marketIndex.findMany({
      where: {
        symbol: {
          in: ['SPY', 'QQQ', 'DIA'],
        },
      },
    });

    const result: any = {};
    for (const index of indices) {
      const key = index.symbol.toLowerCase();
      result[key] = {
        symbol: index.symbol,
        name: index.name,
        currentPrice: Number(index.currentPrice),
        previousClose: Number(index.previousClose),
        changePercent: Number(index.changePercent),
      };
    }

    return result;
  }

  /**
   * Get today's date at market close time (4:00 PM ET)
   * Normalizes to the same time each day for consistency
   */
  private getMarketCloseDate(): Date {
    // Kept for backward compatibility - not used for hourly snapshots
    const now = new Date();
    const closeTime = new Date(now);
    closeTime.setHours(16, 0, 0, 0); // 4:00 PM ET

    // If it's before market close today, use yesterday's date
    // This ensures we only create snapshots after market has closed
    if (now < closeTime) {
      closeTime.setDate(closeTime.getDate() - 1);
    }

    return closeTime;
  }

  /**
   * Get historical snapshots for a portfolio
   */
  async getPortfolioHistory(
    portfolioId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const where: any = { portfolioId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const snapshots = await prisma.fantasyPortfolioSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return snapshots.map(snapshot => ({
      date: snapshot.date,
      totalValue: Number(snapshot.totalValue),
      cashBalance: Number(snapshot.cashBalance),
      stockValue: Number(snapshot.stockValue),
      dayChange: Number(snapshot.dayChange),
      dayChangePercent: Number(snapshot.dayChangePercent),
      sp500Value: snapshot.sp500Value ? Number(snapshot.sp500Value) : null,
      nasdaqValue: snapshot.nasdaqValue ? Number(snapshot.nasdaqValue) : null,
      dowValue: snapshot.dowValue ? Number(snapshot.dowValue) : null,
    }));
  }

  /**
   * Initialize market indices (should be run once during setup)
   */
  async initializeMarketIndices(): Promise<void> {
    const indices = [
      { symbol: 'SPY', name: 'S&P 500', currentPrice: 500 },
      { symbol: 'QQQ', name: 'NASDAQ-100', currentPrice: 400 },
      { symbol: 'DIA', name: 'Dow Jones', currentPrice: 380 },
    ];

    for (const index of indices) {
      await prisma.marketIndex.upsert({
        where: { symbol: index.symbol },
        update: {},
        create: {
          symbol: index.symbol,
          name: index.name,
          currentPrice: new Decimal(index.currentPrice),
          previousClose: new Decimal(index.currentPrice),
          changePercent: new Decimal(0),
        },
      });
    }

    console.log('✅ Initialized market indices (SPY, QQQ, DIA)');
  }
}

interface MarketIndexData {
  symbol: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  changePercent: number;
}

export const portfolioSnapshotService = new PortfolioSnapshotService();
