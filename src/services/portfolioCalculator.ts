/**
 * Portfolio Balance Calculator
 * Calculates the true total value of a portfolio including all asset types
 */

import { Decimal } from '@prisma/client/runtime/library';
import prisma from './prisma';

/**
 * Calculate the total portfolio value
 * Total = Cash Balance + Sum of all stock holdings at current prices
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

  // Start with cash balance
  let totalValue = new Decimal(portfolio.cashBalance);

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
        gainLossPercent: holdingValue
          .sub(new Decimal(slot.averageCost).mul(shares))
          .div(new Decimal(slot.averageCost).mul(shares))
          .mul(100),
      },
    });
  }

  return totalValue;
}

/**
 * Update portfolio's total value in the database
 */
export async function updatePortfolioTotalValue(portfolioId: string): Promise<Decimal> {
  const totalValue = await calculatePortfolioTotalValue(portfolioId);

  await prisma.fantasyPortfolio.update({
    where: { id: portfolioId },
    data: { totalValue },
  });

  return totalValue;
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
