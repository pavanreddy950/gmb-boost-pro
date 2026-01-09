// import admin from 'firebase-admin'; // DISABLED for Node.js v25 compatibility

/**
 * Middleware to verify admin access
 * Firebase Admin SDK disabled - using whitelist bypass
 */
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Firebase Admin SDK disabled - decode token manually
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        let payload64 = parts[1];
        while (payload64.length % 4) {
          payload64 += '=';
        }

        const payload = JSON.parse(Buffer.from(payload64, 'base64').toString());

        // ADMIN WHITELIST: Allow specific users as admin - ONLY scalepointstrategy@gmail.com
        const adminEmails = [
          'scalepointstrategy@gmail.com'
        ];

        if (adminEmails.includes(payload.email)) {
          req.admin = {
            uid: payload.sub || payload.user_id || payload.uid,
            email: payload.email,
            role: 'admin',
            adminLevel: 'super'
          };
          return next();
        }
      }
    } catch (decodeError) {
      console.error('[AdminAuth] Token decode error:', decodeError.message);
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Middleware to check specific admin levels
 */
const checkAdminLevel = (allowedLevels) => {
  return (req, res, next) => {
    const adminLevel = req.admin?.adminLevel || 'viewer';

    if (!allowedLevels.includes(adminLevel)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires ${allowedLevels.join(' or ')} admin level`
      });
    }

    next();
  };
};

export { verifyAdmin, checkAdminLevel };
