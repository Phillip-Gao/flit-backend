import { Router } from 'express';
import userRoutes from './users';
import lessonRoutes from './lessons';
import portfolioRoutes from './portfolio';
import socialRoutes from './social';
import fantasyGroupsRoutes from './fantasyGroups';
import fantasyFeaturesRoutes from './fantasyFeatures';
import fantasyTradingRoutes from './fantasyTrading';
import fantasyPortfolioRoutes from './fantasyPortfolio';
import assetsRoutes from './assets';

const router = Router();

// User management routes
router.use('/users', userRoutes);

// Lesson management routes
router.use('/lessons', lessonRoutes);

// Portfolio management routes (personal portfolios)
router.use('/portfolio', portfolioRoutes);

// Social features routes
router.use('/social', socialRoutes);

// Asset management routes
router.use('/assets', assetsRoutes);

// Fantasy Finance routes
router.use('/fantasy-groups', fantasyTradingRoutes);
router.use('/fantasy-groups', fantasyGroupsRoutes);
router.use('/fantasy', fantasyFeaturesRoutes);
router.use('/fantasy-portfolio', fantasyPortfolioRoutes);

export default router;
