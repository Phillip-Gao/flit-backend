# Stock Price Management with Finnhub

## Overview

The app now uses Finnhub API to fetch real-time stock prices. All stock prices are stored centrally in the `Asset` table and shared across all user portfolios.

## Architecture

### Centralized Asset Management
- **Asset Table**: Central source of truth for all stocks (AAPL, MSFT, GOOGL, etc.)
- **Portfolio Slots**: Reference assets by `assetId`, not storing duplicate price data
- **Automatic Updates**: When asset prices update, all portfolios reflect the new values

### Services

1. **FinnhubService** (`src/services/finnhub.ts`)
   - Fetches real-time quotes from Finnhub API
   - Handles rate limiting (60 calls/minute on free tier)
   - Returns standardized price data

2. **StockPriceUpdater** (`src/services/stockPriceUpdater.ts`)
   - Updates all stock prices in database
   - Recalculates portfolio values automatically
   - Can update all stocks or individual stocks

## Setup

### 1. Get Finnhub API Key

1. Go to [Finnhub.io](https://finnhub.io/)
2. Sign up for free account
3. Copy your API key from the dashboard

### 2. Configure Environment

Add to your `.env` file:

```bash
FINNHUB_API_KEY=your_actual_api_key_here
```

### 3. Test the Connection

Run this script to test your Finnhub connection:

```bash
npx ts-node scripts/update-stock-prices.ts
```

You should see output like:
```
📊 Starting stock price update...
Found 5 stocks to update
Received 5 quotes from Finnhub
✅ Updated AAPL: $178.32 (+1.24%)
✅ Updated GOOGL: $140.25 (+0.85%)
...
✅ Stock price update complete: 5/5 assets updated
✅ Recalculated 8 portfolio values
```

## Usage

### Populate S&P 500 Stocks

First time setup - populate database with S&P 500 stocks:

```bash
npx ts-node scripts/populate-sp500.ts
```

This will:
- Add all S&P 500 stocks to your database
- Fetch initial prices from Finnhub
- Take ~5-10 minutes for full S&P 500 (respects rate limits)

### Manual Price Update

Update all stock prices manually:

```bash
npx ts-node scripts/update-stock-prices.ts
```

### API Endpoints

**Get all assets:**
```http
GET /api/assets
GET /api/assets?type=Stock
GET /api/assets?search=apple
```

**Get specific asset:**
```http
GET /api/assets/AAPL
```

**Trigger price update (all stocks):**
```http
POST /api/assets/update-prices
```

**Update single stock:**
```http
POST /api/assets/AAPL/update-price
```

### Programmatic Usage

```typescript
import { stockPriceUpdater } from './src/services/stockPriceUpdater';

// Update all stocks
await stockPriceUpdater.updateAllStockPrices();

// Update single stock
await stockPriceUpdater.updateStockPrice('AAPL');
```

## Scheduling Daily Updates

### Option 1: Node-cron (Simple)

Install: `npm install node-cron @types/node-cron`

In `src/index.ts`:
```typescript
import cron from 'node-cron';
import { stockPriceUpdater } from './services/stockPriceUpdater';

// Update prices every day at 4 PM EST (market close)
cron.schedule('0 16 * * 1-5', async () => {
  console.log('Running scheduled price update...');
  await stockPriceUpdater.updateAllStockPrices();
}, {
  timezone: "America/New_York"
});
```

### Option 2: External Cron Job

Add to your server's crontab:
```bash
0 16 * * 1-5 cd /path/to/flit-backend && npx ts-node scripts/update-stock-prices.ts
```

### Option 3: GitHub Actions (if deploying)

Create `.github/workflows/update-prices.yml`:
```yaml
name: Update Stock Prices
on:
  schedule:
    - cron: '0 21 * * 1-5' # 4 PM EST = 9 PM UTC
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Update prices
        run: |
          cd flit-backend
          npm install
          npx ts-node scripts/update-stock-prices.ts
```

## Rate Limits

**Finnhub Free Tier:**
- 60 API calls per minute
- Unlimited daily calls

**Current Usage:**
- Each stock = 1 API call
- With rate limiting: 1 call per 1.1 seconds = ~55 calls/minute
- Safe within free tier limits

**S&P 500 Updates:**
- 500 stocks = 500 API calls
- Takes ~9-10 minutes with rate limiting
- Perfect for daily updates
- Won't exceed Finnhub limits

**Scaling:**
- Can handle up to 60 stocks per minute
- For 500 stocks: Run once per day (plenty of time)
- For real-time needs: Consider paid tier ($20/month for more calls)

## How It Works

### Price Update Flow

1. **Fetch**: Get current prices from Finnhub for all active stocks
2. **Update Assets**: Store new prices in Asset table, move current → previousClose
3. **Recalculate Portfolios**: Update all portfolio slot values based on new prices
4. **Update Portfolio Totals**: Recalculate total portfolio values (cash + stocks)

### Data Consistency

- **Single Source of Truth**: Asset table has current price
- **No Duplicate Data**: Portfolio slots reference assets, don't store their own prices
- **Automatic Propagation**: When asset price updates, all portfolios see the change
- **Historical Tracking**: `previousClose` stores yesterday's price for comparison

## Testing

Test with a single stock first:

```bash
# Test AAPL price fetch
npx ts-node -e "
import { finnhubService } from './src/services/finnhub';
finnhubService.getQuote('AAPL').then(quote => {
  console.log('AAPL:', quote);
  process.exit(0);
});
"
```

## Troubleshooting

**"FINNHUB_API_KEY not set"**
- Add your API key to `.env` file
- Restart your server

**"No data returned for ticker"**
- Check ticker symbol is correct (must be uppercase)
- Verify stock is traded on US markets
- Some tickers may not be available on Finnhub

**Rate limit errors**
- Free tier: 60 calls/minute
- Script includes automatic rate limiting
- Wait 1 minute and try again

**Prices not updating in app**
- Check server logs for update completion
- Refresh the app/browser
- Verify asset.currentPrice was updated in database

## Next Steps

1. ✅ Set up Finnhub API key
2. ✅ Test price updates manually
3. 🔄 Set up automated daily updates (choose scheduling method)
4. 🔄 Add more stocks to Asset table as needed
5. 🔄 Monitor API usage to stay within free tier
