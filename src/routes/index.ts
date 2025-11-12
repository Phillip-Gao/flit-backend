import { Router } from 'express';
import userRoutes from './users';
import lessonRoutes from './lessons';
import portfolioRoutes from './portfolio';
import socialRoutes from './social';

const router = Router();

// User management routes
router.use('/users', userRoutes);

// Lesson management routes  
router.use('/lessons', lessonRoutes);

// Portfolio management routes
router.use('/portfolio', portfolioRoutes);

// Social features routes
router.use('/social', socialRoutes);

export default router;
