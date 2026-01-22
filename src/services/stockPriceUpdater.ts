/**
 * Stock Price Updater Service
 * Updates asset prices from Finnhub API
 */

import prisma from './prisma';
import { finnhubService } from './finnhub';

class StockPriceUpdater {
  /**
   * Update prices for all active stocks in the database
   * @param force - If true, update regardless of last update time. If false, only update if stale.
   */
  async updateAllStockPrices(force: boolean = false): Promise<{ updated: boolean; message: string }> {
    try {
      // Check if prices need updating (unless forced)
      if (!force) {
        const recentAsset = await prisma.asset.findFirst({
          where: {
            isActive: true,
            type: 'Stock',
          },
          orderBy: {
            updatedAt: 'desc',
          },
        });

        if (recentAsset) {
          const timeSinceUpdate = Date.now() - recentAsset.updatedAt.getTime();
          const oneHourInMs = 60 * 60 * 1000;

          // If updated within the last hour, skip update
          if (timeSinceUpdate < oneHourInMs) {
            const minutesAgo = Math.round(timeSinceUpdate / 1000 / 60);
            console.log(`⏭️  Skipping update - prices updated ${minutesAgo} minutes ago`);
            return {
              updated: false,
              message: `Prices are fresh (updated ${minutesAgo} minutes ago)`,
            };
          }
        }
      }

      console.log('📊 Starting stock price update...');

      // Get all active stock assets from database
      const assets = await prisma.asset.findMany({
        where: {
          isActive: true,
          type: 'Stock', // Only update stocks, not ETFs/Commodities/REITs for now
        },
        select: {
          id: true,
          ticker: true,
          currentPrice: true,
        },
      });

      if (assets.length === 0) {
        console.log('No active stocks to update');
        return { updated: false, message: 'No active stocks to update' };
      }

      console.log(`Found ${assets.length} stocks to update`);

      // Get quotes from Finnhub
      const tickers = assets.map(a => a.ticker);
      const quotes = await finnhubService.getMultipleQuotes(tickers);

      console.log(`Received ${quotes.length} quotes from Finnhub`);

      // Update database
      let updatedCount = 0;
      for (const quote of quotes) {
        const asset = assets.find(a => a.ticker === quote.ticker);
        if (!asset) continue;

        try {
          await prisma.asset.update({
            where: { id: asset.id },
            data: {
              previousClose: asset.currentPrice, // Move current to previous
              currentPrice: quote.currentPrice,
              updatedAt: new Date(),
            },
          });

          console.log(`✅ Updated ${quote.ticker}: $${quote.currentPrice.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`);
          updatedCount++;
        } catch (error) {
          console.error(`Error updating ${quote.ticker}:`, error);
        }
      }

      console.log(`✅ Stock price update complete: ${updatedCount}/${assets.length} assets updated`);

      // Update portfolio values based on new prices
      await this.recalculatePortfolioValues();

      return {
        updated: true,
        message: `Successfully updated ${updatedCount} stock prices`,
      };

    } catch (error) {
      console.error('Error updating stock prices:', error);
      throw error;
    }
  }

  /**
   * Update a single stock price
   */
  async updateStockPrice(ticker: string): Promise<void> {
    try {
      const asset = await prisma.asset.findUnique({
        where: { ticker },
      });

      if (!asset) {
        throw new Error(`Asset not found: ${ticker}`);
      }

      const quote = await finnhubService.getQuote(ticker);
      if (!quote) {
        throw new Error(`Unable to fetch quote for ${ticker}`);
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          previousClose: asset.currentPrice,
          currentPrice: quote.currentPrice,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Updated ${ticker}: $${quote.currentPrice.toFixed(2)}`);

      // Recalculate portfolio values for portfolios holding this asset
      await this.recalculatePortfolioValues();

    } catch (error) {
      console.error(`Error updating ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Recalculate total values for all portfolios based on current asset prices
   */
  private async recalculatePortfolioValues(): Promise<void> {
    try {
      const portfolios = await prisma.fantasyPortfolio.findMany({
        include: {
          slots: {
            include: {
              asset: true,
            },
          },
        },
      });

      for (const portfolio of portfolios) {
        // Calculate total stock value
        const totalStockValue = portfolio.slots.reduce((sum, slot) => {
          return sum + (Number(slot.shares) * Number(slot.asset.currentPrice));
        }, 0);

        // Update portfolio total value
        const newTotalValue = Number(portfolio.cashBalance) + totalStockValue;

        await prisma.fantasyPortfolio.update({
          where: { id: portfolio.id },
          data: {
            totalValue: newTotalValue,
          },
        });

        // Update each slot's current price and calculated fields
        for (const slot of portfolio.slots) {
          const currentPrice = Number(slot.asset.currentPrice);
          const totalValue = Number(slot.shares) * currentPrice;
          const averageCost = Number(slot.averageCost);
          const gainLoss = (currentPrice - averageCost) * Number(slot.shares);
          const gainLossPercent = averageCost > 0 ? ((currentPrice - averageCost) / averageCost) * 100 : 0;

          await prisma.portfolioSlot.update({
            where: { id: slot.id },
            data: {
              currentPrice,
              totalValue,
              gainLoss,
              gainLossPercent,
            },
          });
        }
      }

      console.log(`✅ Recalculated ${portfolios.length} portfolio values`);
    } catch (error) {
      console.error('Error recalculating portfolio values:', error);
    }
  }
}

export const stockPriceUpdater = new StockPriceUpdater();
