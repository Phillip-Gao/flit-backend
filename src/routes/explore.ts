import { Router } from 'express';
import prisma from '../services/prisma';

const router = Router();

// Mock articles data
const mockArticles = [
  {
    id: 'article-1',
    title: 'Understanding Market Volatility',
    description: 'Learn how to navigate market ups and downs with confidence',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
    category: 'Market Analysis',
    readTime: '5 min read',
    url: 'https://example.com/article-1'
  },
  {
    id: 'article-2',
    title: 'The Power of Dollar-Cost Averaging',
    description: 'Why investing consistently beats timing the market',
    imageUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400',
    category: 'Investment Strategy',
    readTime: '7 min read',
    url: 'https://example.com/article-2'
  },
  {
    id: 'article-3',
    title: 'Diversification 101',
    description: 'Build a resilient portfolio with proper asset allocation',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
    category: 'Portfolio Management',
    readTime: '6 min read',
    url: 'https://example.com/article-3'
  },
  {
    id: 'article-4',
    title: 'Tech Sector Outlook 2026',
    description: 'Analysis of emerging trends in technology investments',
    imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400',
    category: 'Sector Analysis',
    readTime: '8 min read',
    url: 'https://example.com/article-4'
  }
];

/**
 * GET /api/explore
 * Returns curated content for the explore page including lessons, articles, and trending stocks
 */
router.get('/', async (req, res) => {
  try {
    // Fetch featured lessons (active lessons, ordered by order field)
    const featuredLessons = await prisma.lesson.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      take: 6,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        difficulty: true,
        estimatedTime: true,
        rewardDollars: true,
      }
    });

    // Fetch trending assets (ordered by market cap)
    const trendingAssets = await prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { marketCap: 'desc' },
      take: 10,
      select: {
        id: true,
        ticker: true,
        name: true,
        currentPrice: true,
        previousClose: true,
        marketCap: true,
        sector: true,
        type: true,
      }
    });

    // Calculate % change for trending assets
    const trendingWithChange = trendingAssets.map((asset: any) => {
      const changePercent = asset.previousClose && Number(asset.previousClose) > 0
        ? ((Number(asset.currentPrice) - Number(asset.previousClose)) / Number(asset.previousClose) * 100).toFixed(2)
        : '0.00';
      
      return {
        ...asset,
        currentPrice: Number(asset.currentPrice),
        previousClose: Number(asset.previousClose),
        marketCap: asset.marketCap ? Number(asset.marketCap) : null,
        changePercent: parseFloat(changePercent)
      };
    });

    res.json({
      lessons: featuredLessons,
      articles: mockArticles,
      trendingStocks: trendingWithChange,
    });
  } catch (error) {
    console.error('Error fetching explore content:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router;
