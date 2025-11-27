/**
 * Rate Limiter - In-Memory Request Tracking
 *
 * SCALABILITY NOTES (1000+ Concurrent Users):
 * - Current implementation: In-memory (single server only)
 * - For multi-server deployments: Use Redis-backed rate limiter
 * - Limits are set HIGH for production scale (1000+ users)
 * - Read-only operations (token status): NO LIMITS
 * - Write operations (payments, automation): Reasonable per-user limits
 *
 * Features:
 * - Sliding window rate limiting
 * - Per-IP and per-user limits
 * - Automatic cleanup of old requests
 * - Express middleware integration
 *
 * Production Recommendations:
 * - Use Redis for distributed rate limiting across multiple servers
 * - Implement CloudFlare/WAF for DDoS protection at infrastructure level
 * - Monitor rate limit hits via metrics/logging
 */
class RateLimiter {
    constructor() {
        this.requests = new Map(); // key -> timestamps[]
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute

        console.log('[RateLimiter] ✅ Initialized with automatic cleanup');
    }

    /**
     * Check if request is allowed under rate limit
     * @param {string} key - Unique identifier (IP, userId, etc.)
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowSeconds - Time window in seconds
     * @returns {object} - { allowed, remaining, resetIn }
     */
    checkLimit(key, maxRequests, windowSeconds) {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;

        // Get request history for this key
        let timestamps = this.requests.get(key) || [];

        // Remove requests outside the current window
        timestamps = timestamps.filter(ts => now - ts < windowMs);

        // Check if limit exceeded
        if (timestamps.length >= maxRequests) {
            const oldestRequest = timestamps[0];
            const resetIn = Math.ceil((oldestRequest + windowMs - now) / 1000);

            console.log(`[RateLimiter] 🚫 Rate limit exceeded for ${key}  (${timestamps.length}/${maxRequests})`);

            return {
                allowed: false,
                remaining: 0,
                resetIn: resetIn,
                limit: maxRequests
            };
        }

        // Add current request
        timestamps.push(now);
        this.requests.set(key, timestamps);

        return {
            allowed: true,
            remaining: maxRequests - timestamps.length,
            resetIn: windowSeconds,
            limit: maxRequests
        };
    }

    /**
     * Clean up old request records
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour
        let cleaned = 0;

        for (const [key, timestamps] of this.requests.entries()) {
            // Remove timestamps older than 1 hour
            const recent = timestamps.filter(ts => now - ts < maxAge);

            if (recent.length === 0) {
                this.requests.delete(key);
                cleaned++;
            } else if (recent.length < timestamps.length) {
                this.requests.set(key, recent);
            }
        }

        if (cleaned > 0) {
            console.log(`[RateLimiter] 🧹 Cleaned ${cleaned} expired keys`);
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        let totalRequests = 0;

        for (const timestamps of this.requests.values()) {
            totalRequests += timestamps.length;
        }

        return {
            trackedKeys: this.requests.size,
            totalRequests: totalRequests,
            avgRequestsPerKey: this.requests.size > 0
                ? (totalRequests / this.requests.size).toFixed(2)
                : '0.00'
        };
    }

    /**
     * Reset limits for a key (useful for testing)
     */
    reset(key) {
        this.requests.delete(key);
    }

    /**
     * Reset all limits
     */
    resetAll() {
        this.requests.clear();
    }

    /**
     * Destroy rate limiter
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// ========================================
// Express Middleware Functions
// ========================================

/**
 * General API rate limiting
 * 1000 requests per minute per IP (scaled for 1000+ concurrent users)
 * Note: For multi-server deployments, use Redis-backed rate limiter
 */
export function apiRateLimit(req, res, next) {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const result = rateLimiter.checkLimit(key, 1000, 60); // 1000 req/min (was 100)

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetIn);

    if (!result.allowed) {
        return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${result.resetIn} seconds.`,
            retryAfter: result.resetIn
        });
    }

    next();
}

/**
 * Automation endpoint rate limiting
 * 100 requests per hour per user (scaled for active automation management)
 */
export function automationRateLimit(req, res, next) {
    const userId = req.body?.userId || req.query?.userId || req.headers?.['x-user-id'] || 'unknown';
    const key = `automation:${userId}`;
    const result = rateLimiter.checkLimit(key, 100, 3600); // 100/hour (was 20)

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
        return res.status(429).json({
            error: 'Too many automation changes',
            message: `You can only make ${result.limit} automation changes per hour. Please try again in ${Math.ceil(result.resetIn / 60)} minutes.`,
            retryAfter: result.resetIn
        });
    }

    next();
}

/**
 * Auth endpoint rate limiting
 * 500 requests per 15 minutes per IP (scaled for 1000+ concurrent users)
 * High limit needed for: OAuth flows, token refresh, multi-component initialization
 */
export function authRateLimit(req, res, next) {
    const key = `auth:${req.ip}`;
    const result = rateLimiter.checkLimit(key, 500, 900); // 500 per 15 min (was 30)

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
        return res.status(429).json({
            error: 'Too many authentication attempts',
            message: `Too many authentication attempts. Try again in ${Math.ceil(result.resetIn / 60)} minutes.`,
            retryAfter: result.resetIn
        });
    }

    next();
}

/**
 * Token status check rate limiting (read-only operation)
 * NO LIMIT - This is just reading data, unlimited for scalability
 * For 1000+ users, this needs to be unrestricted
 */
export function tokenStatusRateLimit(req, res, next) {
    // No rate limiting for token status checks - it's read-only
    // If DDoS protection needed, implement at infrastructure level (CloudFlare, etc.)
    next();
}

/**
 * Payment endpoint rate limiting
 * 20 requests per 5 minutes per user (increased for subscription flow with multiple API calls)
 */
export function paymentRateLimit(req, res, next) {
    const userId = req.body?.userId || req.query?.userId || 'unknown';
    const key = `payment:${userId}`;
    const result = rateLimiter.checkLimit(key, 20, 300); // 20 per 5 min (was 5)

    if (!result.allowed) {
        return res.status(429).json({
            error: 'Too many payment attempts',
            message: `Too many payment attempts. Try again in ${Math.ceil(result.resetIn / 60)} minutes.`,
            retryAfter: result.resetIn
        });
    }

    next();
}

export default rateLimiter;
