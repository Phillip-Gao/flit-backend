/**
 * Finnhub API Service
 * Free tier: 60 API calls/minute
 * Docs: https://finnhub.io/docs/api
 */

interface FinnhubQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
  t: number;  // Timestamp
}

interface FinnhubCompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  name: string;
  ticker: string;
  ipo: string;
  marketCapitalization: number;
  shareOutstanding: number;
  logo: string;
  phone: string;
  weburl: string;
  finnhubIndustry: string;
}

interface StockPrice {
  ticker: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

interface CompanyInfo {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number | null;
}

interface FinnhubNewsArticle {
  category: string;
  datetime: number; // Unix timestamp
  headline: string;
  id: number;
  image: string;
  related: string; // Ticker symbol
  source: string;
  summary: string;
  url: string;
}

interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image: string;
  publishedAt: Date;
  ticker: string;
}

class FinnhubService {
  private apiKey: string;
  private baseUrl = 'https://finnhub.io/api/v1';

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  FINNHUB_API_KEY not set in environment variables');
    }
  }

  /**
   * Get real-time quote for a single stock
   */
  async getQuote(ticker: string): Promise<StockPrice | null> {
    try {
      if (!this.apiKey) {
        throw new Error('Finnhub API key not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/quote?symbol=${ticker}&token=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as FinnhubQuote;

      // Check if data is valid (Finnhub returns 0s for invalid tickers)
      if (data.c === 0 && data.pc === 0) {
        console.warn(`⚠️  No data returned for ticker: ${ticker}`);
        return null;
      }

      return {
        ticker,
        currentPrice: data.c,
        previousClose: data.pc,
        change: data.d,
        changePercent: data.dp,
        timestamp: new Date(data.t * 1000),
      };
    } catch (error) {
      console.error(`Error fetching quote for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Get company profile information
   */
  async getCompanyProfile(ticker: string): Promise<CompanyInfo | null> {
    try {
      if (!this.apiKey) {
        throw new Error('Finnhub API key not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/stock/profile2?symbol=${ticker}&token=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as FinnhubCompanyProfile;

      // Check if data is valid
      if (!data.name) {
        console.warn(`⚠️  No profile data returned for ticker: ${ticker}`);
        return null;
      }

      return {
        ticker: data.ticker,
        name: data.name,
        sector: data.finnhubIndustry || 'Unknown',
        marketCap: data.marketCapitalization || null,
      };
    } catch (error) {
      console.error(`Error fetching profile for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Get quotes for multiple stocks
   * Implements rate limiting to stay within free tier (60 calls/min)
   * For large batches (100+ stocks), consider using batch mode
   */
  async getMultipleQuotes(tickers: string[], batchMode: boolean = false): Promise<StockPrice[]> {
    const results: StockPrice[] = [];
    const delayMs = 1100; // 1.1 seconds to be safe (60 calls/min)

    if (tickers.length > 10) {
      console.log(`📊 Fetching ${tickers.length} quotes... (estimated time: ~${Math.round(tickers.length * 1.1 / 60)} minutes)`);
    }

    for (const ticker of tickers) {
      const quote = await this.getQuote(ticker);
      if (quote) {
        results.push(quote);
      }
      
      // Rate limiting: wait between requests
      if (tickers.indexOf(ticker) < tickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const quote = await this.getQuote('AAPL');
      return quote !== null;
    } catch (error) {
      console.error('Finnhub connection test failed:', error);
      return false;
    }
  }

  /**
   * Get company news for a specific stock
   * @param ticker Stock ticker symbol
   * @param from Start date (YYYY-MM-DD format)
   * @param to End date (YYYY-MM-DD format)
   */
  async getCompanyNews(
    ticker: string,
    from?: string,
    to?: string
  ): Promise<NewsArticle[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Finnhub API key not configured');
      }

      // Default to last 7 days if dates not provided
      const toDate = to || new Date().toISOString().split('T')[0];
      const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch(
        `${this.baseUrl}/company-news?symbol=${ticker}&from=${fromDate}&to=${toDate}&token=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as FinnhubNewsArticle[];

      // Transform and filter valid articles
      return data
        .filter(article => article.headline && article.url)
        .map(article => ({
          id: article.id,
          headline: article.headline,
          summary: article.summary,
          source: article.source,
          url: article.url,
          image: article.image,
          publishedAt: new Date(article.datetime * 1000),
          ticker: ticker,
        }));
    } catch (error) {
      console.error(`Error fetching news for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Search for stocks by symbol or company name
   * @param query Search query
   */
  async searchSymbol(query: string): Promise<{ symbol: string; description: string; type: string }[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Finnhub API key not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: any[] };
      
      // Return only common stocks
      return (data.result || [])
        .filter((item: any) => item.type === 'Common Stock')
        .slice(0, 10); // Limit to 10 results
    } catch (error) {
      console.error(`Error searching for ${query}:`, error);
      return [];
    }
  }
}

export const finnhubService = new FinnhubService();
export type { StockPrice, CompanyInfo, NewsArticle };
