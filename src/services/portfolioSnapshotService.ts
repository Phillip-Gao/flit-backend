import prisma from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Service for managing daily portfolio snapshots and market baseline comparisons
 */
export class PortfolioSnapshotService {
  /**
   * Take daily snapshots of all portfolios at market close (4:00 PM ET)
   * Call this once per day via cron job
   */
  async takeDailySnapshots(): Promise<void> {
    try {
      const today = this.getMarketCloseDate();
      console.log(`📸 Taking daily portfolio snapshots for ${today.toISOString().split('T')[0]}...`);

      // Get all portfolios with their current values
      const portfolios = await prisma.fantasyPortfolio.findMany({
        include: {
          slots: {
            include: {
              asset: true,
            },
          },
        },
      });

      // Get market indices for baseline calculations
      const marketIndices = await this.getMarketIndices();

      let snapshotCount = 0;

      for (const portfolio of portfolios) {
        // Check if snapshot already exists for today
        const existingSnapshot = await prisma.fantasyPortfolioSnapshot.findUnique({
          where: {
            portfolioId_date: {
              portfolioId: portfolio.id,
              date: today,
            },
          },
        });

        if (existingSnapshot) {
          console.log(`  ⏭️  Snapshot already exists for portfolio ${portfolio.id}`);
          continue;
        }

        // Calculate current values
        const cashBalance = Number(portfolio.cashBalance);
        const stockValue = portfolio.slots.reduce((sum, slot) => {
          return sum + (Number(slot.shares) * Number(slot.asset.currentPrice));
        }, 0);
        const totalValue = cashBalance + stockValue;

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
        const initialValue = Number(portfolio.initialValue);
        const baselines = this.calculateBaselineValues(
          initialValue,
          portfolio.createdAt,
          marketIndices
        );

        // Create snapshot
        await prisma.fantasyPortfolioSnapshot.create({
          data: {
            portfolioId: portfolio.id,
            date: today,
            totalValue: new Decimal(totalValue),
            cashBalance: new Decimal(cashBalance),
            stockValue: new Decimal(stockValue),
            dayChange: new Decimal(dayChange),
            dayChangePercent: new Decimal(dayChangePercent),
            sp500Value: baselines.sp500 ? new Decimal(baselines.sp500) : null,
            nasdaqValue: baselines.nasdaq ? new Decimal(baselines.nasdaq) : null,
            dowValue: baselines.dow ? new Decimal(baselines.dow) : null,
          },
        });

        snapshotCount++;
      }

      console.log(`✅ Created ${snapshotCount} portfolio snapshots`);
    } catch (error) {
      console.error('❌ Error taking daily snapshots:', error);
      throw error;
    }
  }

  /**
   * Calculate what the initial portfolio value would be worth if invested in each market index
   */
  private calculateBaselineValues(
    initialValue: number,
    portfolioCreatedAt: Date,
    marketIndices: { spy?: MarketIndexData; qqq?: MarketIndexData; dia?: MarketIndexData }
  ): { sp500: number | null; nasdaq: number | null; dow: number | null } {
    // For now, we'll use current prices
    // In a production system, you'd want to fetch historical prices for the portfolioCreatedAt date
    // and calculate shares purchased, then multiply by current price

    const result = {
      sp500: null as number | null,
      nasdaq: null as number | null,
      dow: null as number | null,
    };

    // Simple calculation: assume we track daily price changes
    // For a more accurate calculation, you'd need to store the starting price
    // when the portfolio was created and calculate shares bought

    if (marketIndices.spy) {
      // This is a placeholder - in production, calculate actual shares * current price
      result.sp500 = initialValue; // Will be replaced with actual calculation
    }

    if (marketIndices.qqq) {
      result.nasdaq = initialValue; // Will be replaced with actual calculation
    }

    if (marketIndices.dia) {
      result.dow = initialValue; // Will be replaced with actual calculation
    }

    return result;
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
