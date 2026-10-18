import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Basic in-memory IP rate limiter for authentication endpoints
 */
export function rateLimiter(maxRequests = 20, windowMs = 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    let entry = rateLimitMap.get(key);
    if (!entry || entry.resetTime <= now) {
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, entry);
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a minute before retrying.',
      });
    }

    next();
  };
}
