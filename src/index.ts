import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';
import cron from 'node-cron';
import prisma from './services/prisma';
import { stockPriceUpdater } from './services/stockPriceUpdater';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clerk middleware for authentication
app.use(clerkMiddleware());

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
import apiRoutes from './routes';
app.use('/api', apiRoutes);

app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'Flit API' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize scheduled tasks
  initializeScheduledTasks();
});

/**
 * Initialize scheduled tasks for stock price updates
 */
function initializeScheduledTasks() {
  // Check if scheduled tasks are enabled (default: true in production, false in development)
  const enableScheduledTasks = process.env.ENABLE_SCHEDULED_TASKS === 'true' || 
                                 process.env.NODE_ENV === 'production';
  
  if (!enableScheduledTasks) {
    console.log('📅 Scheduled tasks disabled (set ENABLE_SCHEDULED_TASKS=true to enable)');
    return;
  }

  console.log('📅 Initializing scheduled tasks...');

  // Update stock prices every hour at minute 0
  // Cron format: minute hour day month day-of-week
  cron.schedule('0 * * * *', async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n⏰ [${timestamp}] Running hourly stock price update...`);
    
    try {
      await stockPriceUpdater.updateAllStockPrices(false);
      console.log(`✅ [${timestamp}] Hourly update completed successfully\n`);
    } catch (error) {
      console.error(`❌ [${timestamp}] Hourly update failed:`, error);
    }
  });

  console.log('✅ Scheduled task registered: Stock price updates every hour');
  console.log('   Next update will run at the top of the next hour (e.g., 2:00, 3:00, 4:00...)');
}

export default app;
