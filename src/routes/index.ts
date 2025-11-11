import { Router } from 'express';
import userRoutes from './users';

const router = Router();

// User management routes
router.use('/users', userRoutes);

export default router;
