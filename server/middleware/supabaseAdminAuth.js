// import admin from 'firebase-admin'; // DISABLED for Node.js v25 compatibility
import supabaseConfig from '../config/supabase.js';

/**
 * Supabase-based Admin Authentication Middleware
 * Firebase Admin SDK disabled - using whitelist bypass
 */

let supabaseClient = null;

async function getSupabaseClient() {
  if (!supabaseClient) {
    await supabaseConfig.initialize();
    supabaseClient = supabaseConfig.getClient();
  }
  return supabaseClient;
}

/**
 * Verify admin access using token whitelist (Firebase disabled)
 */
const verifySupabaseAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Decode token manually (Firebase Admin SDK disabled)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        let payload64 = parts[1];
        while (payload64.length % 4) {
          payload64 += '=';
        }

        const payload = JSON.parse(Buffer.from(payload64, 'base64').toString());
        console.log('[SupabaseAdminAuth] Token decoded for:', payload.email);

        // ADMIN WHITELIST: Allow specific emails
        const adminEmails = [
          'scalepointstrategy@gmail.com',
          'meenakarjale73@gmail.com',
          'hello.lobaiseo@gmail.com'
        ];

        if (adminEmails.includes(payload.email)) {
          req.admin = {
            uid: payload.sub || payload.user_id || payload.uid,
            email: payload.email,
            role: 'admin',
            adminLevel: 'super',
            source: 'whitelist_bypass'
          };

          console.log('[SupabaseAdminAuth] ✅ Admin access granted:', payload.email);
          return next();
        } else {
          console.log('[SupabaseAdminAuth] ❌ User not in admin whitelist:', payload.email);
        }
      }
    } catch (decodeError) {
      console.error('[SupabaseAdminAuth] Token decode error:', decodeError.message);
    }

    // DEVELOPMENT TEST TOKENS
    if (token === 'fake-admin-token' || token.includes('test-admin')) {
      console.log('[SupabaseAdminAuth] ✅ Test admin token accepted');
      req.admin = {
        uid: 'test-admin-uid',
        email: 'test-admin@localhost.com',
        role: 'admin',
        adminLevel: 'super',
        source: 'test_bypass'
      };
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });

  } catch (error) {
    console.error('[SupabaseAdminAuth] ❌ Authentication error:', error);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Check specific admin levels
 */
const checkSupabaseAdminLevel = (allowedLevels) => {
  return (req, res, next) => {
    const adminLevel = req.admin?.adminLevel || 'viewer';

    if (!allowedLevels.includes(adminLevel)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires ${allowedLevels.join(' or ')} admin level. Current level: ${adminLevel}`
      });
    }

    next();
  };
};

export { verifySupabaseAdmin as verifyAdmin, checkSupabaseAdminLevel as checkAdminLevel };
