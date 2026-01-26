import express from 'express';
import multer from 'multer';
import reviewRequestService from '../services/reviewRequestService.js';
import gmailPoolService from '../services/gmailPoolService.js';

const router = express.Router();

/**
 * Multer configuration for file uploads
 * Accepts CSV and Excel files up to 10MB
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedTypes = ['csv', 'xls', 'xlsx'];

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${ext}. Allowed types: CSV, XLS, XLSX`));
    }
  }
});

// ============================================
// FILE UPLOAD ENDPOINTS
// ============================================

/**
 * POST /upload
 * Upload and process a customer file (CSV/Excel)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userId, locationId, locationName, businessName, reviewLink } = req.body;

    if (!userId || !locationId || !businessName) {
      return res.status(400).json({
        error: 'Missing required fields: userId, locationId, businessName'
      });
    }

    const result = await reviewRequestService.uploadAndProcess({
      userId,
      locationId,
      locationName,
      businessName,
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      reviewLink
    });

    res.json({
      success: true,
      message: `Successfully imported ${result.newCustomers} customers`,
      ...result
    });
  } catch (error) {
    console.error('[ReviewRequests] Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CUSTOMER ENDPOINTS
// ============================================

/**
 * GET /customers
 * Get customer list for a location
 */
router.get('/customers', async (req, res) => {
  try {
    const { userId, locationId, status, batchId, limit, offset } = req.query;

    if (!userId || !locationId) {
      return res.status(400).json({ error: 'Missing required fields: userId, locationId' });
    }

    const customers = await reviewRequestService.getCustomers({
      userId,
      locationId,
      status,
      batchId,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0
    });

    res.json({ success: true, customers, count: customers.length });
  } catch (error) {
    console.error('[ReviewRequests] Get customers error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /customer/:id
 * Delete a single customer
 */
router.delete('/customer/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const customerId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    await reviewRequestService.deleteCustomer({ userId, customerId });
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    console.error('[ReviewRequests] Delete customer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BATCH ENDPOINTS
// ============================================

/**
 * GET /batches
 * Get upload batch history for a location
 */
router.get('/batches', async (req, res) => {
  try {
    const { userId, locationId } = req.query;

    if (!userId || !locationId) {
      return res.status(400).json({ error: 'Missing required fields: userId, locationId' });
    }

    const batches = await reviewRequestService.getBatchHistory({ userId, locationId });
    res.json({ success: true, batches });
  } catch (error) {
    console.error('[ReviewRequests] Get batches error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /batch/:id
 * Delete a batch and all its customers
 */
router.delete('/batch/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const batchId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    await reviewRequestService.deleteBatch({ userId, batchId });
    res.json({ success: true, message: 'Batch deleted' });
  } catch (error) {
    console.error('[ReviewRequests] Delete batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATS ENDPOINTS
// ============================================

/**
 * GET /stats
 * Get location statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { userId, locationId } = req.query;

    if (!userId || !locationId) {
      return res.status(400).json({ error: 'Missing required fields: userId, locationId' });
    }

    const stats = await reviewRequestService.getLocationStats({ userId, locationId });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[ReviewRequests] Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tracking-stats
 * Get email tracking statistics (open rate, click rate, etc.)
 */
router.get('/tracking-stats', async (req, res) => {
  try {
    const { userId, locationId } = req.query;

    if (!userId || !locationId) {
      return res.status(400).json({ error: 'Missing required fields: userId, locationId' });
    }

    const stats = await reviewRequestService.getTrackingStats({ userId, locationId });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[ReviewRequests] Get tracking stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EMAIL SEND ENDPOINTS
// ============================================

/**
 * POST /send
 * Send review request emails to customers
 */
router.post('/send', async (req, res) => {
  console.log('[ReviewRequests] ====== SEND EMAIL REQUEST RECEIVED ======');
  console.log('[ReviewRequests] Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { userId, locationId, customerIds, businessName, reviewLink, customSenderName } = req.body;

    console.log('[ReviewRequests] Parsed params:');
    console.log('  - userId:', userId);
    console.log('  - locationId:', locationId);
    console.log('  - customerIds:', customerIds);
    console.log('  - businessName:', businessName);
    console.log('  - reviewLink:', reviewLink);
    console.log('  - customSenderName:', customSenderName);

    if (!userId || !locationId) {
      console.log('[ReviewRequests] ❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: userId, locationId' });
    }

    console.log('[ReviewRequests] Calling reviewRequestService.sendReviewRequests...');
    const result = await reviewRequestService.sendReviewRequests({
      userId,
      locationId,
      customerIds,
      businessName,
      reviewLink,
      customSenderName
    });

    console.log('[ReviewRequests] ✅ sendReviewRequests completed:', JSON.stringify(result, null, 2));

    res.json({
      success: true,
      message: `Sent ${result.sent} emails (${result.failed} failed)`,
      ...result
    });
  } catch (error) {
    console.error('[ReviewRequests] ❌ Send error:', error);
    console.error('[ReviewRequests] Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /email-pool-status
 * Get Gmail pool status (accounts, limits, usage)
 */
router.get('/email-pool-status', async (req, res) => {
  try {
    const status = await gmailPoolService.getPoolStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('[ReviewRequests] Pool status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REVIEW SYNC ENDPOINTS
// ============================================

/**
 * POST /sync-reviews
 * Match Google reviews with customers
 */
router.post('/sync-reviews', async (req, res) => {
  try {
    const { userId, locationId, reviews } = req.body;

    if (!userId || !locationId) {
      return res.status(400).json({ error: 'Missing required fields: userId, locationId' });
    }

    const result = await reviewRequestService.matchReviewsWithCustomers({
      userId,
      locationId,
      reviews
    });

    res.json({
      success: true,
      message: `Matched ${result.matched} of ${result.total} reviews`,
      ...result
    });
  } catch (error) {
    console.error('[ReviewRequests] Sync reviews error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TRACKING ENDPOINTS (Called by email clients)
// ============================================

/**
 * GET /track/open/:customerId
 * Track email open - returns 1x1 transparent GIF
 * This is called when the tracking pixel in the email is loaded
 */
router.get('/track/open/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    // Track the open (fire and forget)
    reviewRequestService.trackEmailOpen(customerId).catch(err => {
      console.error('[ReviewRequests] Track open error:', err);
    });

    // Return transparent 1x1 GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.send(pixel);
  } catch (error) {
    // Still return pixel even on error
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
  }
});

/**
 * GET /track/click/:customerId
 * Track link click - redirects to actual review page
 * This is called when user clicks "Leave a Review" button
 */
router.get('/track/click/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    // Track the click and get the review link
    const reviewLink = await reviewRequestService.trackLinkClick(customerId);

    // Redirect to the actual Google review page
    if (reviewLink) {
      res.redirect(302, reviewLink);
    } else {
      // Fallback to Google if no link found
      res.redirect(302, 'https://www.google.com');
    }
  } catch (error) {
    console.error('[ReviewRequests] Track click error:', error);
    res.redirect(302, 'https://www.google.com');
  }
});

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * DELETE /all
 * Delete all customers and batches for a location
 */
router.delete('/all', async (req, res) => {
  try {
    const { userId, locationId } = req.query;

    if (!userId || !locationId) {
      return res.status(400).json({ error: 'Missing required fields: userId, locationId' });
    }

    await reviewRequestService.deleteAllCustomers({ userId, locationId });
    res.json({ success: true, message: 'All customers deleted' });
  } catch (error) {
    console.error('[ReviewRequests] Delete all error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
