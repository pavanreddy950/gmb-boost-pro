import express from 'express';
import multer from 'multer';
import photoService from '../services/photoService.js';
import supabaseConfig from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/photos/debug/health
 * Check if photo service is working
 */
/**
 * GET /api/photos/debug/check/:locationId
 * Check what photos exist for a specific location
 */
router.get('/debug/check/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const client = await supabaseConfig.ensureInitialized();

    const { data: photos, error } = await client
      .from('location_photos')
      .select('photo_id, location_id, status, queue_position, public_url, business_name')
      .eq('location_id', locationId)
      .order('queue_position', { ascending: true });

    res.json({
      success: true,
      locationId,
      photosFound: photos?.length || 0,
      pendingPhotos: photos?.filter(p => p.status === 'pending').length || 0,
      photos: photos || [],
      error: error?.message || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/debug/health', async (req, res) => {
  try {
    const client = await supabaseConfig.ensureInitialized();

    // Check if location_photos table exists
    const { data: tableCheck, error: tableError } = await client
      .from('location_photos')
      .select('id')
      .limit(1);

    // Check if storage bucket exists
    const { data: buckets, error: bucketError } = await client.storage.listBuckets();
    const photoBucket = buckets?.find(b => b.name === 'location-photos');

    res.json({
      success: true,
      database: {
        connected: true,
        tableExists: !tableError,
        tableError: tableError?.message || null
      },
      storage: {
        bucketsFound: buckets?.length || 0,
        photoBucketExists: !!photoBucket,
        photoBucketInfo: photoBucket || null,
        bucketError: bucketError?.message || null
      },
      message: !tableError && photoBucket
        ? '✅ Everything is set up correctly!'
        : '❌ Setup incomplete - see details above'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check Supabase connection and credentials'
    });
  }
});

// Configure multer for memory storage (we'll process and compress before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
    files: 60 // Max 60 files per request
  },
  fileFilter: (req, file, cb) => {
    // Accept all common image formats - Sharp will convert them to JPEG
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/tiff',
      'image/bmp',
      'image/avif',
      'image/heic',      // iPhone photos
      'image/heif',      // iPhone photos
      'image/svg+xml'    // SVG (will be rasterized)
    ];

    // Also check file extension for formats that may have wrong/missing mimetype
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif', '.bmp', '.avif', '.heic', '.heif', '.svg'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, GIF, TIFF, BMP, AVIF, HEIC`));
    }
  }
});

/**
 * POST /api/photos/upload
 * Upload photos for a location (supports bulk upload)
 */
router.post('/upload', upload.array('photos', 60), async (req, res) => {
  try {
    const { gmailId, locationId, businessName } = req.body;

    if (!gmailId || !locationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: gmailId and locationId'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    console.log(`[Photos API] 📤 Uploading ${req.files.length} photos for ${businessName || locationId}`);

    const results = [];
    const errors = [];

    // Process each file
    for (const file of req.files) {
      try {
        const result = await photoService.uploadPhoto(
          gmailId,
          locationId,
          businessName || 'Unknown',
          file.buffer,
          file.originalname
        );
        results.push(result);
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    const totalUploaded = results.length;
    const totalFailed = errors.length;

    console.log(`[Photos API] ✅ Upload complete: ${totalUploaded} success, ${totalFailed} failed`);

    res.json({
      success: true,
      message: `Uploaded ${totalUploaded} of ${req.files.length} photos`,
      uploaded: totalUploaded,
      failed: totalFailed,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Photos API] ❌ Upload error:', error);
    console.error('[Photos API] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload photos',
      details: error.toString(),
      hint: error.message?.includes('location_photos')
        ? 'Database table not created. Run the SQL schema first.'
        : error.message?.includes('storage') || error.message?.includes('bucket')
        ? 'Storage bucket not created. Create "location-photos" bucket in Supabase.'
        : 'Check server logs for details'
    });
  }
});

/**
 * GET /api/photos/:locationId
 * Get all photos for a location
 */
router.get('/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { gmailId } = req.query;

    if (!gmailId) {
      return res.status(400).json({
        success: false,
        error: 'Missing gmailId query parameter'
      });
    }

    const photos = await photoService.getPhotosForLocation(gmailId, locationId);
    const pendingCount = photos.filter(p => p.status === 'pending').length;

    res.json({
      success: true,
      locationId,
      total: photos.length,
      pending: pendingCount,
      daysRemaining: pendingCount, // 1 photo = 1 day
      photos
    });
  } catch (error) {
    console.error('[Photos API] ❌ Fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch photos'
    });
  }
});

/**
 * GET /api/photos/stats/:gmailId
 * Get photo stats for all locations of a user
 */
router.get('/stats/:gmailId', async (req, res) => {
  try {
    const { gmailId } = req.params;

    const stats = await photoService.getPhotoStatsForUser(gmailId);
    const storageUsage = await photoService.getStorageUsage(gmailId);

    res.json({
      success: true,
      gmailId,
      locations: stats,
      storage: storageUsage,
      totalLocations: stats.length,
      totalPhotos: stats.reduce((sum, s) => sum + s.total, 0),
      totalPending: stats.reduce((sum, s) => sum + s.pending, 0)
    });
  } catch (error) {
    console.error('[Photos API] ❌ Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stats'
    });
  }
});

/**
 * DELETE /api/photos/:photoId
 * Delete a specific photo
 */
router.delete('/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    const { gmailId } = req.query;

    if (!gmailId) {
      return res.status(400).json({
        success: false,
        error: 'Missing gmailId query parameter'
      });
    }

    await photoService.deletePhoto(gmailId, photoId);

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('[Photos API] ❌ Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete photo'
    });
  }
});

/**
 * POST /api/photos/reorder
 * Reorder photos in the queue
 */
router.post('/reorder', async (req, res) => {
  try {
    const { gmailId, locationId, photoIds } = req.body;

    if (!gmailId || !locationId || !photoIds || !Array.isArray(photoIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: gmailId, locationId, and photoIds array'
      });
    }

    await photoService.reorderPhotos(gmailId, locationId, photoIds);

    res.json({
      success: true,
      message: 'Photos reordered successfully'
    });
  } catch (error) {
    console.error('[Photos API] ❌ Reorder error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reorder photos'
    });
  }
});

/**
 * GET /api/photos/next/:locationId
 * Get next pending photo for auto-posting (internal use)
 */
router.get('/next/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;

    const photo = await photoService.getNextPendingPhoto(locationId);

    if (!photo) {
      return res.json({
        success: true,
        hasPhoto: false,
        message: 'No pending photos for this location'
      });
    }

    res.json({
      success: true,
      hasPhoto: true,
      photo
    });
  } catch (error) {
    console.error('[Photos API] ❌ Next photo error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get next photo'
    });
  }
});

/**
 * POST /api/photos/:photoId/mark-used
 * Mark photo as used after successful post
 */
router.post('/:photoId/mark-used', async (req, res) => {
  try {
    const { photoId } = req.params;
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({
        success: false,
        error: 'Missing postId'
      });
    }

    const photo = await photoService.markPhotoAsUsed(photoId, postId);

    res.json({
      success: true,
      message: 'Photo marked as used and deleted from storage',
      photo
    });
  } catch (error) {
    console.error('[Photos API] ❌ Mark used error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark photo as used'
    });
  }
});

/**
 * POST /api/photos/:photoId/mark-failed
 * Mark photo as failed (will be retried)
 */
router.post('/:photoId/mark-failed', async (req, res) => {
  try {
    const { photoId } = req.params;
    const { errorMessage } = req.body;

    await photoService.markPhotoAsFailed(photoId, errorMessage || 'Unknown error');

    res.json({
      success: true,
      message: 'Photo marked as failed'
    });
  } catch (error) {
    console.error('[Photos API] ❌ Mark failed error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark photo as failed'
    });
  }
});

/**
 * POST /api/photos/:photoId/reset
 * Reset failed photo to pending for retry
 */
router.post('/:photoId/reset', async (req, res) => {
  try {
    const { photoId } = req.params;

    await photoService.resetFailedPhoto(photoId);

    res.json({
      success: true,
      message: 'Photo reset to pending'
    });
  } catch (error) {
    console.error('[Photos API] ❌ Reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset photo'
    });
  }
});

export default router;
