import { Router } from 'express';
import userRoutes from './users';
import lessonRoutes from './lessons';
import portfolioRoutes from './portfolio';
import socialRoutes from './social';
import fantasyLeaguesRoutes from './fantasyLeagues';
import fantasyFeaturesRoutes from './fantasyFeatures';
import fantasyTradingRoutes from './fantasyTrading';

const router = Router();

// User management routes
router.use('/users', userRoutes);

// Lesson management routes
router.use('/lessons', lessonRoutes);

// Portfolio management routes (personal portfolios)
router.use('/portfolio', portfolioRoutes);

// Social features routes
router.use('/social', socialRoutes);

// Fantasy Finance routes
router.use('/fantasy-leagues', fantasyTradingRoutes);
router.use('/fantasy-leagues', fantasyLeaguesRoutes);
router.use('/fantasy', fantasyFeaturesRoutes);

export default router;
