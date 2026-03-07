import subscriptionGuard from '../services/subscriptionGuard.js';

/**
 * Subscription enforcement middleware (Supabase-backed).
 *
 * Blocks ALL functionality for users whose trial or subscription has expired.
 * Must be applied BEFORE route handlers in server.js.
 *
 * How userId is extracted (in priority order):
 *  1. x-user-id header
 *  2. query.userId or query.email
 *  3. body.userId or body.email
 *
 * If no userId is found the request is treated as a public/unauthenticated
 * request and is allowed through (e.g. public QR-code review pages).
 */
export const enforceSubscription = async (req, res, next) => {
  try {
    const userId =
      req.headers['x-user-id'] ||
      req.query.userId ||
      req.query.email ||
      req.body?.userId ||
      req.body?.email;

    // Public / unauthenticated requests — allow through
    if (!userId || userId === 'default' || userId === 'anonymous') {
      return next();
    }

    const gbpAccountId =
      req.headers['x-gbp-account-id'] ||
      req.query.gbpAccountId ||
      req.body?.gbpAccountId;

    const access = await subscriptionGuard.hasValidAccess(userId, gbpAccountId);

    if (!access.hasAccess) {
      console.log(`[EnforceSubscription] Blocked ${userId}: ${access.reason}`);
      return res.status(403).json({
        error: 'Subscription expired',
        message:
          access.message ||
          'Your trial/subscription has expired. Please upgrade to continue.',
        reason: access.reason,
        requiresPayment: true,
        redirectTo: '/billing'
      });
    }

    // Attach subscription info for downstream handlers
    req.subscription = access;
    next();
  } catch (error) {
    console.error('[EnforceSubscription] Error checking subscription:', error);
    // Fail open so a transient DB error does not lock out all users
    next();
  }
};

export default enforceSubscription;
