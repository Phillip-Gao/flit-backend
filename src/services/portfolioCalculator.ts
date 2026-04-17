/**
 * Portfolio Balance Calculator
 * Calculates the true total value of a portfolio including all asset types
 */

import { Decimal } from '@prisma/client/runtime/library';
import prisma from './prisma';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const SAVINGS_APY = 0.043; // Typical high-yield savings APY
const BONDS_APY = 0.051; // Conservative aggregate bond-like APY

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const dateKeyUTC = (date: Date): string =>
  `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;

async function applyAlternativeAssetReturns(portfolio: {
  updatedAt: Date;
  savingsAccount: Decimal;
  bonds: Decimal;
  indexFunds: Decimal;
}) {
  const now = new Date();
  const elapsedMs = Math.max(0, now.getTime() - portfolio.updatedAt.getTime());
  const elapsedYears = elapsedMs / MS_PER_YEAR;

  const currentSavings = Number(portfolio.savingsAccount);
  const currentBonds = Number(portfolio.bonds);
  const currentIndexFunds = Number(portfolio.indexFunds);

  // Compound continuously based on elapsed wall time since portfolio's last update.
  const savingsAccount =
    currentSavings > 0 && elapsedYears > 0
      ? roundCurrency(currentSavings * Math.pow(1 + SAVINGS_APY, elapsedYears))
      : currentSavings;

  const bonds =
    currentBonds > 0 && elapsedYears > 0
      ? roundCurrency(currentBonds * Math.pow(1 + BONDS_APY, elapsedYears))
      : currentBonds;

  let indexFunds = currentIndexFunds;
  if (currentIndexFunds > 0) {
    // Track S&P 500 via SPY daily move (applied once per UTC day).
    const lastAccrualDay = dateKeyUTC(portfolio.updatedAt);
    const today = dateKeyUTC(now);
    if (lastAccrualDay !== today) {
      const spy = await prisma.marketIndex.findUnique({
        where: { symbol: 'SPY' },
        select: { currentPrice: true, previousClose: true },
      });
      const currentPrice = Number(spy?.currentPrice ?? 0);
      const previousClose = Number(spy?.previousClose ?? 0);
      if (currentPrice > 0 && previousClose > 0) {
        indexFunds = roundCurrency(currentIndexFunds * (currentPrice / previousClose));
      }
    }
  }

  return {
    savingsAccount,
    bonds,
    indexFunds,
  };
}

/**
 * Calculate the total portfolio value
 * Total = Cash + Stock Holdings + Savings + Bonds + Index Funds
 */
export async function calculatePortfolioTotalValue(portfolioId: string): Promise<Decimal> {
  const portfolio = await prisma.fantasyPortfolio.findUnique({
    where: { id: portfolioId },
    include: {
      slots: {
        include: {
          asset: true,
        },
      },
    },
  });

  if (!portfolio) {
    throw new Error('Portfolio not found');
  }

  const adjustedAlternativeAssets = await applyAlternativeAssetReturns(portfolio);

  // Start with cash balance + other asset allocations
  let totalValue = new Decimal(portfolio.cashBalance)
    .add(new Decimal(adjustedAlternativeAssets.savingsAccount))
    .add(new Decimal(adjustedAlternativeAssets.bonds))
    .add(new Decimal(adjustedAlternativeAssets.indexFunds));

  // Add value of all stock holdings (using current price from asset)
  for (const slot of portfolio.slots) {
    const currentPrice = new Decimal(slot.asset.currentPrice);
    const shares = new Decimal(slot.shares);
    const holdingValue = currentPrice.mul(shares);
    totalValue = totalValue.add(holdingValue);

    // Also update the slot's current values while we're at it
    await prisma.portfolioSlot.update({
      where: { id: slot.id },
      data: {
        currentPrice: slot.asset.currentPrice,
        totalValue: holdingValue,
        gainLoss: holdingValue.sub(new Decimal(slot.averageCost).mul(shares)),
        gainLossPercent: new Decimal(slot.averageCost).mul(shares).isZero()
          ? new Decimal(0)
          : holdingValue
              .sub(new Decimal(slot.averageCost).mul(shares))
              .div(new Decimal(slot.averageCost).mul(shares))
              .mul(100),
      },
    });
  }

  await prisma.fantasyPortfolio.update({
    where: { id: portfolio.id },
    data: {
      savingsAccount: new Decimal(adjustedAlternativeAssets.savingsAccount),
      bonds: new Decimal(adjustedAlternativeAssets.bonds),
      indexFunds: new Decimal(adjustedAlternativeAssets.indexFunds),
      totalValue,
    },
  });

  return totalValue;
}

/**
 * Update portfolio's total value in the database
 */
export async function updatePortfolioTotalValue(portfolioId: string): Promise<Decimal> {
  return calculatePortfolioTotalValue(portfolioId);
}

/**
 * Recalculate total value for all portfolios of a specific user
 */
export async function recalculateUserPortfolios(userId: string): Promise<void> {
  const portfolios = await prisma.fantasyPortfolio.findMany({
    where: { userId },
  });

  for (const portfolio of portfolios) {
    await updatePortfolioTotalValue(portfolio.id);
  }
}

/**
 * Recalculate total value for all portfolios (useful after price updates)
 */
export async function recalculateAllPortfolios(): Promise<void> {
  const portfolios = await prisma.fantasyPortfolio.findMany();

  for (const portfolio of portfolios) {
    await updatePortfolioTotalValue(portfolio.id);
  }
}
