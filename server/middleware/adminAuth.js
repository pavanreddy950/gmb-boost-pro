import admin from 'firebase-admin';

/**
 * Middleware to verify admin access
 * Checks if the user has admin role in Firebase custom claims
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

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Check if user has admin role
    if (decodedToken.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }

    // Attach admin info to request
    req.admin = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role,
      adminLevel: decodedToken.adminLevel || 'super'
    };

    next();
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
 * @param {Array<string>} allowedLevels - e.g., ['super', 'moderator']
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
