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
    this.compressionConfig = {
      maxWidth: 1200,           // Max width for GBP
      maxHeight: 1200,          // Max height for GBP
      quality: 85,              // JPEG quality (85 = good balance)
      format: 'jpeg',           // JPEG format (GBP doesn't support WebP!)
      targetSizeKB: 100,        // Target max size in KB
      minQuality: 60,           // Don't go below this quality
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

      if (width > this.compressionConfig.maxWidth || height > this.compressionConfig.maxHeight) {
        const ratio = Math.min(
          this.compressionConfig.maxWidth / width,
          this.compressionConfig.maxHeight / height
        );
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Adaptive compression - start with target quality and reduce if needed
      let quality = this.compressionConfig.quality;
      let compressedBuffer;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        compressedBuffer = await sharp(imageBuffer)
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true
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

      const compressedSize = compressedBuffer.length;
      const compressionRatio = compressedSize / originalSize;
      const savingsPercent = ((1 - compressionRatio) * 100).toFixed(1);

      const duration = Date.now() - startTime;

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
   * Mark photo as used (after successful post)
   */
  async markPhotoAsUsed(photoId, postId) {
    await this.initialize();

    const { data, error } = await this.client
      .from('location_photos')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_in_post_id: postId
      })
      .eq('photo_id', photoId)
      .select()
      .single();

    if (error) {
      console.error('[PhotoService] ❌ Mark used error:', error);
      throw error;
    }

    console.log(`[PhotoService] ✅ Photo ${photoId} marked as used in post ${postId}`);

    // ⚠️ IMPORTANT: Do NOT delete immediately!
    // Google's API fetches the image asynchronously from our sourceUrl.
    // If we delete too fast, Google won't be able to download the image.
    // Instead, schedule deletion after 2 hours to give Google time to fetch it.
    const storagePath = data.storage_path;
    setTimeout(async () => {
      try {
        console.log(`[PhotoService] 🗑️ Delayed cleanup: Deleting photo ${photoId} from storage (2 hours after use)`);
        await this.deletePhotoFromStorage(storagePath);
      } catch (err) {
        console.warn(`[PhotoService] ⚠️ Delayed cleanup failed for ${photoId}:`, err.message);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours delay

    console.log(`[PhotoService] ⏰ Photo ${photoId} scheduled for deletion in 2 hours`);

    return data;
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
