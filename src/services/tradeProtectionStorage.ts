export type IdempotencyRecord = {
  statusCode: number;
  body: unknown;
  expiresAt: number;
};

export type RateLimitResult = {
  count: number;
  resetAt: number;
};

export interface TradeRateLimitStorage {
  increment(key: string, windowMs: number, now: number): Promise<RateLimitResult>;
}

export interface TradeIdempotencyStorage {
  get(key: string, now: number): Promise<IdempotencyRecord | null>;
  set(key: string, value: IdempotencyRecord, ttlMs: number): Promise<void>;
}

export class InMemoryTradeRateLimitStorage implements TradeRateLimitStorage {
  private store = new Map<string, RateLimitResult>();

  async increment(key: string, windowMs: number, now: number): Promise<RateLimitResult> {
    const existing = this.store.get(key);

    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.store.set(key, fresh);
      return fresh;
    }

    const updated = { ...existing, count: existing.count + 1 };
    this.store.set(key, updated);
    return updated;
  }
}

export class InMemoryTradeIdempotencyStorage implements TradeIdempotencyStorage {
  private store = new Map<string, IdempotencyRecord>();

  async get(key: string, now: number): Promise<IdempotencyRecord | null> {
    const existing = this.store.get(key);
    if (!existing) return null;

    if (existing.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }

    return existing;
  }

  async set(key: string, value: IdempotencyRecord): Promise<void> {
    this.store.set(key, value);
  }
}

/**
 * A minimal Redis-compatible interface that adapters can satisfy.
 * You can implement this wrapper around ioredis, node-redis, Upstash, etc.
 */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  incr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, ttlMs: number): Promise<void>;
}

export class RedisTradeRateLimitStorage implements TradeRateLimitStorage {
  constructor(
    private readonly redis: RedisLikeClient,
    private readonly prefix = 'trade:ratelimit'
  ) {}

  async increment(key: string, windowMs: number, now: number): Promise<RateLimitResult> {
    const redisKey = `${this.prefix}:${key}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
      return { count, resetAt: now + windowMs };
    }

    const ttlMs = await this.redis.pttl(redisKey);
    const boundedTtl = ttlMs > 0 ? ttlMs : windowMs;
    return { count, resetAt: now + boundedTtl };
  }
}

export class RedisTradeIdempotencyStorage implements TradeIdempotencyStorage {
  constructor(
    private readonly redis: RedisLikeClient,
    private readonly prefix = 'trade:idempotency'
  ) {}

  async get(key: string, now: number): Promise<IdempotencyRecord | null> {
    const redisKey = `${this.prefix}:${key}`;
    const raw = await this.redis.get(redisKey);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as IdempotencyRecord;
    if (parsed.expiresAt <= now) {
      return null;
    }

    return parsed;
  }

  async set(key: string, value: IdempotencyRecord, ttlMs: number): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await this.redis.set(redisKey, JSON.stringify(value), ttlMs);
  }
}
