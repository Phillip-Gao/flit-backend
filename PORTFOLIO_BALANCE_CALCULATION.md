# Portfolio Balance Calculation

## Overview

The portfolio balance system ensures that the total portfolio value is accurately calculated and updated based on real-time stock prices that are refreshed every hour.

## Components of Portfolio Balance

### Total Portfolio Value = Cash Balance + Stock Holdings Value

1. **Cash Balance (Liquid Funds)**
   - Amount available for trading
   - Stored in `FantasyPortfolio.cashBalance`
   - Updated immediately when buying or selling stocks

2. **Stock Holdings Value**
   - Sum of (Current Price × Shares) for all stocks
   - Calculated dynamically based on:
     - Number of shares owned (from `PortfolioSlot.shares`)
     - Current market price (from `Asset.currentPrice`)
   - Updated every hour when stock prices refresh

3. **Total Value**
   - Stored in `FantasyPortfolio.totalValue`
   - Recalculated automatically when:
     - Stock prices are updated (every hour)
     - A trade is executed (buy/sell)
     - Manual recalculation is triggered

## Automatic Updates

### Hourly Price Updates
The stock price updater runs every hour to:
1. Fetch latest quotes from Finnhub API for all S&P 500 stocks
2. Update `Asset.currentPrice` for each stock
3. Recalculate portfolio values for all users
4. Update gain/loss metrics for each holding

**Service:** `src/services/stockPriceUpdater.ts`
- Method: `updateAllStockPrices()`
- Calls: `recalculatePortfolioValues()` after price updates

### Trade Execution
When a user buys or sells stocks:
1. Update cash balance (subtract for buy, add for sell)
2. Update or create portfolio slot
3. Recalculate total value = cash + sum of (shares × current price)
4. Create transaction record

**Route:** `src/routes/fantasyPortfolio.ts`
- POST `/api/fantasy-portfolio/trade`

## Manual Recalculation

### Portfolio Calculator Service
Provides utilities to recalculate portfolio values on demand.

**Service:** `src/services/portfolioCalculator.ts`

**Functions:**
- `calculatePortfolioTotalValue(portfolioId)` - Calculate total for one portfolio
- `updatePortfolioTotalValue(portfolioId)` - Calculate and save to database
- `recalculateUserPortfolios(userId)` - Recalculate all portfolios for a user
- `recalculateAllPortfolios()` - Recalculate all portfolios in system

### API Endpoint
Manual recalculation can be triggered via API:

```bash
POST /api/fantasy-portfolio/recalculate
```

Returns updated portfolio balances for current user.

## Frontend Display

The portfolio screen shows:
- **Total Portfolio Value**: Cash + Stock Holdings
- **Cash Balance**: Available for trading
- **Stock Holdings**: Total value of all stocks at current prices
- **Note**: "Portfolio value is automatically updated every hour with real-time stock prices"

## Calculation Example

### Tech Investors Portfolio
```
Cash Balance:     $7,500.00
+ AAPL (10 shares × $248.35):  $2,483.50
+ LHX (3 shares × $355.36):    $1,066.08
─────────────────────────────────────────
Total Value:      $11,049.58
```

### Value Hunters Portfolio
```
Cash Balance:     $6,800.00
+ MSFT (8 shares × $451.14):   $3,609.12
+ AAPL (8 shares × $248.35):   $1,986.80
+ LHX (1 share × $355.36):       $355.36
─────────────────────────────────────────
Total Value:      $12,751.28
```

## Data Flow

```
1. Hourly Timer Triggers
   ↓
2. stockPriceUpdater.updateAllStockPrices()
   ↓
3. Fetch quotes from Finnhub API
   ↓
4. Update Asset.currentPrice in database
   ↓
5. recalculatePortfolioValues()
   ↓
6. For each portfolio:
   - Calculate total stock value from slots
   - Add cash balance
   - Update FantasyPortfolio.totalValue
   ↓
7. Update PortfolioSlot metrics:
   - currentPrice
   - totalValue
   - gainLoss
   - gainLossPercent
```

## Database Schema

### FantasyPortfolio
```prisma
model FantasyPortfolio {
  cashBalance  Decimal  // Liquid funds available for trading
  totalValue   Decimal  // Cash + Stock Holdings
  slots        PortfolioSlot[]
}
```

### PortfolioSlot
```prisma
model PortfolioSlot {
  shares          Decimal  // Number of shares owned
  averageCost     Decimal  // Average cost per share (for P&L)
  currentPrice    Decimal  // Current market price (from Asset)
  totalValue      Decimal  // shares × currentPrice
  gainLoss        Decimal  // totalValue - (shares × averageCost)
  gainLossPercent Decimal  // (gainLoss / cost basis) × 100
}
```

### Asset
```prisma
model Asset {
  ticker        String   @unique
  currentPrice  Decimal  // Updated every hour from Finnhub
  previousClose Decimal  // Previous day's closing price
}
```

## Notes for Future Features

### Not Yet Implemented (Hardcoded for Mock Users)
The following asset types are planned but not yet implemented:
- Savings Accounts
- Bonds
- Index Funds (ETFs are supported but not categorized separately)

For your personal portfolio (phillipgao), the calculation is fully functional and includes:
✅ Cash Balance (liquid funds)
✅ Stock Holdings (updated hourly with real prices)
✅ Automatic recalculation after price updates
✅ Accurate total portfolio value

For mock users in your groups, their portfolios are also functional with the same calculation logic.
