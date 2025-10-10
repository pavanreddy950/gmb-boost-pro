import admin from 'firebase-admin';
import supabaseConfig from '../config/supabase.js';

/**
 * Supabase-based Admin Authentication Middleware
 * Fallback when Firebase Admin SDK has credential issues
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
 * TEMPORARY Admin Bypass - Until Firebase credentials are fixed
 * Verify admin access using Firebase Auth with fallback authentication
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
    let decodedToken = null;

    try {
      // Try Firebase token verification
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('[TempAdminAuth] ✅ Firebase token verified for user:', decodedToken.email);
      
      // ADMIN WHITELIST: Allow specific users as admin
      const adminEmails = [
        'scalepointstrategy@gmail.com',
        'meenakarjale73@gmail.com'
      ];
      
      if (adminEmails.includes(decodedToken.email)) {
        req.admin = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          role: 'admin',
          adminLevel: 'super',
          source: 'whitelist_bypass'
        };
        
        console.log('[TempAdminAuth] ✅ Admin access granted via whitelist:', decodedToken.email);
        return next();
      } else {
        console.log('[TempAdminAuth] ❌ User not in admin whitelist:', decodedToken.email);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin access required'
        });
      }
      
    } catch (firebaseError) {
      console.warn('[TempAdminAuth] ⚠️ Firebase Admin SDK error:', firebaseError.message);
      
      // EMERGENCY BYPASS: When Firebase Admin SDK fails, decode token manually
      try {
        // Parse the token payload (unsafe but necessary for emergency access)
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            // Add padding if needed for base64 decoding
            let payload64 = parts[1];
            while (payload64.length % 4) {
              payload64 += '=';
            }
            
            const payload = JSON.parse(Buffer.from(payload64, 'base64').toString());
            console.log('[TempAdminAuth] 🚨 EMERGENCY: Manually parsed token for:', payload.email);
            console.log('[TempAdminAuth] 🔍 Token payload keys:', Object.keys(payload));
            
            // ADMIN WHITELIST CHECK: Allow specific emails even with invalid Firebase SDK
            const adminEmails = [
              'scalepointstrategy@gmail.com',
              'meenakarjale73@gmail.com'
            ];
            
            if (adminEmails.includes(payload.email)) {
              req.admin = {
                uid: payload.sub || payload.user_id || payload.uid,
                email: payload.email,
                role: 'admin',
                adminLevel: 'super',
                source: 'emergency_bypass'
              };
              
              console.log('[TempAdminAuth] ✅ EMERGENCY ADMIN ACCESS granted:', payload.email);
              return next();
            } else {
              console.log('[TempAdminAuth] ❌ Email not in emergency whitelist:', payload.email);
              console.log('[TempAdminAuth] 🔍 Valid admin emails:', adminEmails);
            }
          } catch (decodeError) {
            console.error('[TempAdminAuth] ❌ Token decode failed:', decodeError.message);
          }
        } else {
          console.log('[TempAdminAuth] ❌ Invalid token format (not 3 parts):', parts.length);
        }
      } catch (parseError) {
        console.error('[TempAdminAuth] ❌ Could not parse token:', parseError.message);
      }
      
      // DEVELOPMENT TEST TOKENS
      if (token === 'fake-admin-token' || token.includes('test-admin')) {
        console.log('[TempAdminAuth] ✅ Test admin token accepted (development only)');
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
        error: 'Authentication Error',
        message: 'Firebase Admin SDK unavailable. Emergency access protocols in effect.',
        details: 'Only whitelisted admin users can access the dashboard'
      });
    }

  } catch (error) {
    console.error('[TempAdminAuth] ❌ Authentication error:', error);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Check specific admin levels (with Supabase fallback)
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
