import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import supabaseConfig from '../config/supabase.js';

/**
 * Photo Service for Photo Dump Feature
 * Handles: Upload, Compression, Storage, Queue Management, Cleanup
 */
class PhotoService {
  constructor() {
    this.client = null;
    this.initialized = false;

    // Compression settings (target: 50-100KB with no visible quality loss)
    // NOTE: Using JPEG instead of WebP because Google Business Profile API doesn't support WebP
    // IMPORTANT: Google Business Profile API requires images to be at least 10KB (10,240 bytes)
    // IMPORTANT: Google Business Profile API requires images to be at least 250x250 pixels
    this.compressionConfig = {
      maxWidth: 1200,           // Max width for GBP
      maxHeight: 1200,          // Max height for GBP
      minWidth: 250,            // Min width for GBP (Google requirement)
      minHeight: 250,           // Min height for GBP (Google requirement)
      quality: 85,              // JPEG quality (85 = good balance)
      format: 'jpeg',           // JPEG format (GBP doesn't support WebP!)
      targetSizeKB: 100,        // Target max size in KB
      minSizeKB: 15,            // Minimum size in KB (GBP requires 10KB minimum, use 15KB for safety)
      minQuality: 60,           // Don't go below this quality
      maxQuality: 100,          // Max quality to try if image is too small
    };

    // Instagram aspect ratio requirements
    // Min: 4:5 (0.8) - portrait
    // Max: 1.91:1 (1.91) - landscape
    // Safe: 1:1 (1.0) - square
    this.instagramConfig = {
      minAspectRatio: 0.8,      // 4:5 portrait
      maxAspectRatio: 1.91,     // 1.91:1 landscape
      paddingColor: { r: 255, g: 255, b: 255 }  // White padding
    };

    // Limits
    this.MAX_PHOTOS_PER_LOCATION = 60;
    this.STORAGE_BUCKET = 'location-photos';
  }

  async initialize() {
    if (this.initialized && this.client) {
      return this.client;
    }
    try {
      this.client = await supabaseConfig.ensureInitialized();
      this.initialized = true;
      console.log('[PhotoService] ✅ Initialized successfully');
      return this.client;
    } catch (error) {
      console.error('[PhotoService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Compress and convert image to JPEG format
   * Accepts: JPEG, PNG, WebP, GIF, TIFF, BMP, AVIF, HEIC, SVG
   * Output: Always JPEG (for GBP API compatibility)
   * Uses adaptive quality to hit target size without visible quality loss
   */
  async compressImage(imageBuffer, originalFilename) {
    try {
      const startTime = Date.now();
      const originalSize = imageBuffer.length;
      const ext = originalFilename.toLowerCase().substring(originalFilename.lastIndexOf('.'));

      console.log(`[PhotoService] 🖼️ Processing: ${originalFilename} (${(originalSize / 1024).toFixed(1)}KB)`);
      console.log(`[PhotoService] 🔄 Input format: ${ext} → Output: JPEG`);

      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();

      // Calculate resize dimensions (maintain aspect ratio)
      let width = metadata.width;
      let height = metadata.height;
      let needsEnlargement = false;

      // FIRST: Check if image is too small (Google requires 250x250 minimum)
      if (width < this.compressionConfig.minWidth || height < this.compressionConfig.minHeight) {
        console.log(`[PhotoService] ⚠️ Image too small (${width}x${height}), enlarging to meet 250x250 minimum`);
        needsEnlargement = true;

        // Calculate scale factor to meet minimum dimensions
        const scaleRatio = Math.max(
          this.compressionConfig.minWidth / width,
          this.compressionConfig.minHeight / height
        );
        width = Math.round(width * scaleRatio);
        height = Math.round(height * scaleRatio);
        console.log(`[PhotoService] 📐 Enlarged to: ${width}x${height}`);
      }

      // THEN: Check if image is too large (max 1200x1200)
      if (width > this.compressionConfig.maxWidth || height > this.compressionConfig.maxHeight) {
        const ratio = Math.min(
          this.compressionConfig.maxWidth / width,
          this.compressionConfig.maxHeight / height
        );
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Adaptive compression - start with target quality and adjust as needed
      let quality = this.compressionConfig.quality;
      let compressedBuffer;
      let attempts = 0;
      const maxAttempts = 5;

      // First pass: compress down if too large (or enlarge if too small)
      do {
        compressedBuffer = await sharp(imageBuffer)
          .resize(width, height, {
            fit: needsEnlargement ? 'cover' : 'inside',
            withoutEnlargement: !needsEnlargement  // Allow enlargement if image is too small
          })
          .jpeg({
            quality: quality,
            mozjpeg: true  // Better compression with mozjpeg
          })
          .toBuffer();

        const currentSizeKB = compressedBuffer.length / 1024;

        if (currentSizeKB <= this.compressionConfig.targetSizeKB) {
          break;
        }

        // Reduce quality for next attempt
        quality -= 5;
        attempts++;

        console.log(`[PhotoService] 📉 Size ${currentSizeKB.toFixed(1)}KB > target, reducing quality to ${quality}`);

      } while (quality >= this.compressionConfig.minQuality && attempts < maxAttempts);

      // Second pass: if image is TOO SMALL (below Google's 10KB minimum), increase quality
      let currentSizeKB = compressedBuffer.length / 1024;
      attempts = 0;

      while (currentSizeKB < this.compressionConfig.minSizeKB && quality < this.compressionConfig.maxQuality && attempts < maxAttempts) {
        quality += 10; // Increase quality
        quality = Math.min(quality, this.compressionConfig.maxQuality);

        console.log(`[PhotoService] 📈 Size ${currentSizeKB.toFixed(1)}KB < minimum ${this.compressionConfig.minSizeKB}KB, increasing quality to ${quality}`);

        compressedBuffer = await sharp(imageBuffer)
          .resize(width, height, {
            fit: needsEnlargement ? 'cover' : 'inside',
            withoutEnlargement: !needsEnlargement
          })
          .jpeg({
            quality: quality,
            mozjpeg: true
          })
          .toBuffer();

        currentSizeKB = compressedBuffer.length / 1024;
        attempts++;
      }

      // Final check: if still too small, try without mozjpeg (less aggressive compression)
      if (currentSizeKB < this.compressionConfig.minSizeKB) {
        console.log(`[PhotoService] ⚠️ Still too small at ${currentSizeKB.toFixed(1)}KB, trying without mozjpeg optimization`);
        compressedBuffer = await sharp(imageBuffer)
          .resize(width, height, {
            fit: needsEnlargement ? 'cover' : 'inside',
            withoutEnlargement: !needsEnlargement
          })
          .jpeg({
            quality: this.compressionConfig.maxQuality,
            mozjpeg: false  // Standard JPEG for larger output
          })
          .toBuffer();
        currentSizeKB = compressedBuffer.length / 1024;
      }

      const compressedSize = compressedBuffer.length;
      const compressionRatio = compressedSize / originalSize;
      const savingsPercent = ((1 - compressionRatio) * 100).toFixed(1);

      const duration = Date.now() - startTime;

      // Log warning if still below minimum
      if (currentSizeKB < this.compressionConfig.minSizeKB) {
        console.warn(`[PhotoService] ⚠️ WARNING: Final size ${currentSizeKB.toFixed(1)}KB is below Google's 10KB minimum. Post may fail.`);
      }

      console.log(`[PhotoService] ✅ Compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${savingsPercent}% smaller) in ${duration}ms`);

      return {
        buffer: compressedBuffer,
        originalSize,
        compressedSize,
        compressionRatio,
        width,
        height,
        mimeType: 'image/jpeg',
        quality
      };
    } catch (error) {
      console.error('[PhotoService] ❌ Compression error:', error);
      throw error;
    }
  }

  /**
   * Fix aspect ratio for Instagram compatibility
   * Instagram requires aspect ratios between 0.8 (4:5) and 1.91 (1.91:1)
   * If outside this range, pad the image with white background to make it square (1:1)
   *
   * @param {string} imageUrl - URL of the image to process
   * @returns {Promise<string>} - URL of the processed image (or original if already valid)
   */
  async fixAspectRatioForInstagram(imageUrl) {
    try {
      console.log(`[PhotoService] 📐 Checking aspect ratio for Instagram: ${imageUrl}`);

      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`[PhotoService] ❌ Failed to fetch image: ${response.status}`);
        return imageUrl; // Return original URL if fetch fails
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(imageBuffer).metadata();

      const aspectRatio = metadata.width / metadata.height;
      console.log(`[PhotoService] 📐 Original dimensions: ${metadata.width}x${metadata.height}, aspect ratio: ${aspectRatio.toFixed(3)}`);

      // Check if aspect ratio is within Instagram's valid range
      if (aspectRatio >= this.instagramConfig.minAspectRatio && aspectRatio <= this.instagramConfig.maxAspectRatio) {
        console.log(`[PhotoService] ✅ Aspect ratio ${aspectRatio.toFixed(3)} is valid for Instagram`);
        return imageUrl; // No modification needed
      }

      console.log(`[PhotoService] ⚠️ Aspect ratio ${aspectRatio.toFixed(3)} is outside Instagram's range (${this.instagramConfig.minAspectRatio}-${this.instagramConfig.maxAspectRatio})`);
      console.log(`[PhotoService] 🔧 Padding image to make it square (1:1)...`);

      // Calculate new dimensions to make it square
      const maxDim = Math.max(metadata.width, metadata.height);

      // Pad the image to make it square with white background
      const paddedBuffer = await sharp(imageBuffer)
        .resize(maxDim, maxDim, {
          fit: 'contain',
          background: this.instagramConfig.paddingColor
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log(`[PhotoService] ✅ Padded image to ${maxDim}x${maxDim} (1:1 square)`);

      // Upload the padded image to temporary storage
      await this.initialize();
      const tempId = `temp_ig_${Date.now()}`;
      const tempPath = `temp/${tempId}.jpg`;

      const { data: uploadData, error: uploadError } = await this.client.storage
        .from(this.STORAGE_BUCKET)
        .upload(tempPath, paddedBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '300', // Short cache for temp files
          upsert: true
        });

      if (uploadError) {
        console.error('[PhotoService] ❌ Failed to upload padded image:', uploadError);
        return imageUrl; // Return original URL if upload fails
      }

      // Get public URL for the padded image
      const { data: urlData } = this.client.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(tempPath);

      const paddedUrl = urlData?.publicUrl;
      console.log(`[PhotoService] ✅ Padded image uploaded: ${paddedUrl}`);

      // Schedule cleanup of temp file after 10 minutes
      setTimeout(async () => {
        try {
          await this.client.storage.from(this.STORAGE_BUCKET).remove([tempPath]);
          console.log(`[PhotoService] 🗑️ Cleaned up temp Instagram image: ${tempPath}`);
        } catch (err) {
          console.warn(`[PhotoService] ⚠️ Failed to cleanup temp image: ${err.message}`);
        }
      }, 10 * 60 * 1000);

      return paddedUrl;
    } catch (error) {
      console.error('[PhotoService] ❌ Error fixing aspect ratio:', error);
      return imageUrl; // Return original URL on error
    }
  }

  /**
   * Upload photo for a location
   * Handles: validation, compression, storage, database entry
   */
  async uploadPhoto(gmailId, locationId, businessName, imageBuffer, originalFilename) {
    try {
      await this.initialize();

      console.log(`[PhotoService] 📤 Uploading photo for ${businessName} (${locationId})`);

      // Check current photo count for this location
      const currentCount = await this.getPhotoCount(gmailId, locationId);
      if (currentCount >= this.MAX_PHOTOS_PER_LOCATION) {
        throw new Error(`Maximum ${this.MAX_PHOTOS_PER_LOCATION} photos per location. Current: ${currentCount}`);
      }

      // Compress the image
      const compressed = await this.compressImage(imageBuffer, originalFilename);

      // Generate unique photo ID and storage path
      const photoId = uuidv4();
      const storagePath = `${gmailId}/${locationId}/${photoId}.jpg`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.client.storage
        .from(this.STORAGE_BUCKET)
        .upload(storagePath, compressed.buffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[PhotoService] ❌ Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = this.client.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      const publicUrl = urlData?.publicUrl;

      // Get next queue position
      const nextPosition = currentCount + 1;

      // Save to database
      const { data: dbData, error: dbError } = await this.client
        .from('location_photos')
        .insert({
          gmail_id: gmailId,
          location_id: locationId,
          business_name: businessName,
          photo_id: photoId,
          original_filename: originalFilename,
          storage_path: storagePath,
          public_url: publicUrl,
          original_size_bytes: compressed.originalSize,
          compressed_size_bytes: compressed.compressedSize,
          compression_ratio: compressed.compressionRatio,
          mime_type: compressed.mimeType,
          width: compressed.width,
          height: compressed.height,
          queue_position: nextPosition,
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) {
        // Cleanup storage if DB insert fails
        await this.client.storage.from(this.STORAGE_BUCKET).remove([storagePath]);
        console.error('[PhotoService] ❌ Database insert error:', dbError);
        throw dbError;
      }

      console.log(`[PhotoService] ✅ Photo uploaded: ${photoId} (position ${nextPosition}/${this.MAX_PHOTOS_PER_LOCATION})`);

      return {
        success: true,
        photo: dbData,
        compression: {
          originalSizeKB: (compressed.originalSize / 1024).toFixed(1),
          compressedSizeKB: (compressed.compressedSize / 1024).toFixed(1),
          savingsPercent: ((1 - compressed.compressionRatio) * 100).toFixed(1)
        }
      };
    } catch (error) {
      console.error('[PhotoService] ❌ Upload error:', error);
      throw error;
    }
  }

  /**
   * Get photo count for a location
   */
  async getPhotoCount(gmailId, locationId) {
    await this.initialize();

    const { count, error } = await this.client
      .from('location_photos')
      .select('*', { count: 'exact', head: true })
      .eq('gmail_id', gmailId)
      .eq('location_id', locationId)
      .eq('status', 'pending');

    if (error) {
      console.error('[PhotoService] ❌ Count error:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get all photos for a location
   */
  async getPhotosForLocation(gmailId, locationId) {
    await this.initialize();

    const { data, error } = await this.client
      .from('location_photos')
      .select('*')
      .eq('gmail_id', gmailId)
      .eq('location_id', locationId)
      .order('queue_position', { ascending: true });

    if (error) {
      console.error('[PhotoService] ❌ Fetch error:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get photo stats for all locations of a user
   */
  async getPhotoStatsForUser(gmailId) {
    await this.initialize();

    const { data, error } = await this.client
      .from('location_photos')
      .select('location_id, business_name, status')
      .eq('gmail_id', gmailId);

    if (error) {
      console.error('[PhotoService] ❌ Stats error:', error);
      throw error;
    }

    // Group by location
    const stats = {};
    (data || []).forEach(photo => {
      if (!stats[photo.location_id]) {
        stats[photo.location_id] = {
          locationId: photo.location_id,
          businessName: photo.business_name,
          total: 0,
          pending: 0,
          used: 0,
          failed: 0
        };
      }
      stats[photo.location_id].total++;
      stats[photo.location_id][photo.status]++;
    });

    return Object.values(stats);
  }

  /**
   * Get next pending photo for auto-posting
   */
  async getNextPendingPhoto(locationId) {
    await this.initialize();

    const { data, error } = await this.client
      .from('location_photos')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'pending')
      .order('queue_position', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No pending photos
        return null;
      }
      console.error('[PhotoService] ❌ Get next photo error:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete photo after successful use
   * Removes from database immediately, but keeps storage file for 2 hours
   * so Google/Facebook/Instagram can fetch the image
   */
  async markPhotoAsUsed(photoId, postId) {
    await this.initialize();

    // First, get the photo record to get the storage path
    const { data: photoData, error: fetchError } = await this.client
      .from('location_photos')
      .select('*')
      .eq('photo_id', photoId)
      .single();

    if (fetchError) {
      console.error('[PhotoService] ❌ Fetch photo error:', fetchError);
      throw fetchError;
    }

    const storagePath = photoData.storage_path;
    console.log(`[PhotoService] 🗑️ Photo ${photoId} used in post ${postId}, deleting from database...`);

    // Delete from database immediately (won't show in Photo Queue anymore)
    const { error: deleteError } = await this.client
      .from('location_photos')
      .delete()
      .eq('photo_id', photoId);

    if (deleteError) {
      console.error('[PhotoService] ❌ Delete from database error:', deleteError);
      throw deleteError;
    }

    console.log(`[PhotoService] ✅ Photo ${photoId} deleted from database`);

    // ⚠️ IMPORTANT: Keep storage file for 2 hours!
    // Google/Facebook/Instagram fetch the image asynchronously from our URL.
    // If we delete too fast, they won't be able to download the image.
    setTimeout(async () => {
      try {
        console.log(`[PhotoService] 🗑️ Delayed cleanup: Deleting photo ${photoId} from storage (2 hours after use)`);
        await this.deletePhotoFromStorage(storagePath);
      } catch (err) {
        console.warn(`[PhotoService] ⚠️ Delayed cleanup failed for ${photoId}:`, err.message);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours delay

    console.log(`[PhotoService] ⏰ Storage file scheduled for deletion in 2 hours`);

    return photoData;
  }

  /**
   * Mark photo as failed (post failed, will retry)
   */
  async markPhotoAsFailed(photoId, errorMessage) {
    await this.initialize();

    const { error } = await this.client
      .from('location_photos')
      .update({
        status: 'failed',
        error_message: errorMessage
      })
      .eq('photo_id', photoId);

    if (error) {
      console.error('[PhotoService] ❌ Mark failed error:', error);
      throw error;
    }

    console.log(`[PhotoService] ⚠️ Photo ${photoId} marked as failed: ${errorMessage}`);
  }

  /**
   * Reset failed photo to pending (for retry)
   */
  async resetFailedPhoto(photoId) {
    await this.initialize();

    const { error } = await this.client
      .from('location_photos')
      .update({
        status: 'pending',
        error_message: null
      })
      .eq('photo_id', photoId);

    if (error) {
      console.error('[PhotoService] ❌ Reset failed error:', error);
      throw error;
    }

    console.log(`[PhotoService] 🔄 Photo ${photoId} reset to pending`);
  }

  /**
   * Delete photo from storage
   */
  async deletePhotoFromStorage(storagePath) {
    try {
      await this.initialize();

      const { error } = await this.client.storage
        .from(this.STORAGE_BUCKET)
        .remove([storagePath]);

      if (error) {
        console.warn('[PhotoService] ⚠️ Storage delete warning:', error);
      } else {
        console.log(`[PhotoService] 🗑️ Deleted from storage: ${storagePath}`);
      }
    } catch (error) {
      console.warn('[PhotoService] ⚠️ Storage delete error:', error);
    }
  }

  /**
   * Delete a pending photo (user action)
   */
  async deletePhoto(gmailId, photoId) {
    await this.initialize();

    // Get photo info first
    const { data: photo, error: fetchError } = await this.client
      .from('location_photos')
      .select('*')
      .eq('gmail_id', gmailId)
      .eq('photo_id', photoId)
      .single();

    if (fetchError || !photo) {
      throw new Error('Photo not found');
    }

    // Delete from storage
    await this.deletePhotoFromStorage(photo.storage_path);

    // Delete from database
    const { error: deleteError } = await this.client
      .from('location_photos')
      .delete()
      .eq('photo_id', photoId);

    if (deleteError) {
      console.error('[PhotoService] ❌ Delete error:', deleteError);
      throw deleteError;
    }

    // Reorder queue positions
    await this.reorderQueue(gmailId, photo.location_id);

    console.log(`[PhotoService] 🗑️ Photo ${photoId} deleted`);
    return { success: true };
  }

  /**
   * Reorder queue positions after deletion
   */
  async reorderQueue(gmailId, locationId) {
    await this.initialize();

    // Get all pending photos for this location
    const { data: photos, error } = await this.client
      .from('location_photos')
      .select('id, queue_position')
      .eq('gmail_id', gmailId)
      .eq('location_id', locationId)
      .eq('status', 'pending')
      .order('queue_position', { ascending: true });

    if (error || !photos) return;

    // Update positions to be sequential
    for (let i = 0; i < photos.length; i++) {
      if (photos[i].queue_position !== i + 1) {
        await this.client
          .from('location_photos')
          .update({ queue_position: i + 1 })
          .eq('id', photos[i].id);
      }
    }
  }

  /**
   * Reorder photos (drag and drop)
   */
  async reorderPhotos(gmailId, locationId, photoIds) {
    await this.initialize();

    // Update each photo's position based on new order
    for (let i = 0; i < photoIds.length; i++) {
      await this.client
        .from('location_photos')
        .update({ queue_position: i + 1 })
        .eq('gmail_id', gmailId)
        .eq('photo_id', photoIds[i]);
    }

    console.log(`[PhotoService] 🔄 Reordered ${photoIds.length} photos for location ${locationId}`);
    return { success: true };
  }

  /**
   * Get storage usage for a user
   */
  async getStorageUsage(gmailId) {
    await this.initialize();

    const { data, error } = await this.client
      .from('location_photos')
      .select('compressed_size_bytes, original_size_bytes')
      .eq('gmail_id', gmailId)
      .eq('status', 'pending');

    if (error) {
      console.error('[PhotoService] ❌ Storage usage error:', error);
      return { totalBytes: 0, totalMB: 0, savedBytes: 0, savedMB: 0 };
    }

    const totalCompressed = (data || []).reduce((sum, p) => sum + (p.compressed_size_bytes || 0), 0);
    const totalOriginal = (data || []).reduce((sum, p) => sum + (p.original_size_bytes || 0), 0);
    const savedBytes = totalOriginal - totalCompressed;

    return {
      totalBytes: totalCompressed,
      totalMB: (totalCompressed / 1024 / 1024).toFixed(2),
      savedBytes,
      savedMB: (savedBytes / 1024 / 1024).toFixed(2),
      photoCount: data?.length || 0
    };
  }
}

// Singleton instance
const photoService = new PhotoService();
export default photoService;
