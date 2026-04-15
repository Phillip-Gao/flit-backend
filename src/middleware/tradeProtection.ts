import { NextFunction, Request, Response } from 'express';
import {
  InMemoryTradeIdempotencyStorage,
  InMemoryTradeRateLimitStorage,
  TradeIdempotencyStorage,
  TradeRateLimitStorage,
} from '../services/tradeProtectionStorage';

let rateLimitStorage: TradeRateLimitStorage = new InMemoryTradeRateLimitStorage();
let idempotencyStorage: TradeIdempotencyStorage = new InMemoryTradeIdempotencyStorage();

export function configureTradeProtectionStorage(config: {
  rateLimitStorage?: TradeRateLimitStorage;
  idempotencyStorage?: TradeIdempotencyStorage;
}) {
  if (config.rateLimitStorage) {
    rateLimitStorage = config.rateLimitStorage;
  }
  if (config.idempotencyStorage) {
    idempotencyStorage = config.idempotencyStorage;
  }
}

function getRequestScope(req: Request): string {
  return req.userId || req.ip || 'unknown';
}

function getIdempotencyStoreKey(req: Request): string | null {
  const key = req.header('x-idempotency-key');
  if (!key) return null;

  // Scope idempotency to user + route path to avoid cross-user/cross-route reuse.
  const scope = getRequestScope(req);
  return `${scope}:${req.method}:${req.path}:${key}`;
}

export function tradeRateLimit(windowMs = 60_000, maxRequests = 30) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
    const now = Date.now();
    const scope = getRequestScope(req);
    const storeKey = `${scope}:${req.method}:${req.path}`;

      const current = await rateLimitStorage.increment(storeKey, windowMs, now);

      if (current.count > maxRequests) {
        const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many trade requests',
        message: 'Please wait and retry.',
      });
    }

      next();
    } catch (error) {
      console.error('Trade rate limit middleware error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function tradeIdempotency(ttlMs = 5 * 60_000) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
    const now = Date.now();
    const storeKey = getIdempotencyStoreKey(req);
    if (!storeKey) {
      return next();
    }

      const cached = await idempotencyStorage.get(storeKey, now);
      if (cached) {
      return res.status(cached.statusCode).json(cached.body);
    }

    const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
      if (res.statusCode < 500) {
          void idempotencyStorage.set(storeKey, {
          statusCode: res.statusCode,
          body,
          expiresAt: Date.now() + ttlMs,
          }, ttlMs);
      }
      return originalJson(body);
    };

      next();
    } catch (error) {
      console.error('Trade idempotency middleware error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
