import express from 'express';
import QRCode from 'qrcode';
import QRCodeStorageService from '../services/qrCodeStorage.js';
import config from '../config.js';

const router = express.Router();
const qrStorage = new QRCodeStorageService();

// Get all QR codes for user
router.get('/', async (req, res) => {
  try {
    const qrCodes = await qrStorage.getAllQRCodes();
    res.json({ qrCodes });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

// Get QR code for specific location
router.get('/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const qrCode = await qrStorage.getQRCode(locationId);
    
    if (!qrCode) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }
    
    res.json({ qrCode });
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).json({ error: 'Failed to fetch QR code' });
  }
});

// Create/Save QR code for location
router.post('/', async (req, res) => {
  try {
    const { locationId, locationName, address, placeId, googleReviewLink } = req.body;
    
    if (!locationId || !locationName || !googleReviewLink) {
      return res.status(400).json({ 
        error: 'Missing required fields: locationId, locationName, googleReviewLink' 
      });
    }

    // Generate public review URL using config
    const publicReviewUrl = `${config.frontendUrl}/review/${locationId}?` + 
      `business=${encodeURIComponent(locationName)}&` +
      `location=${encodeURIComponent(address || '')}&` +
      `placeId=${encodeURIComponent(placeId || '')}&` +
      `googleReviewLink=${encodeURIComponent(googleReviewLink)}`;

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(publicReviewUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 512
    });

    // Save to storage
    const qrCodeData = {
      locationName,
      address: address || '',
      placeId: placeId || '',
      googleReviewLink,
      qrCodeUrl,
      publicReviewUrl
    };

    const savedQRCode = await qrStorage.saveQRCode(locationId, qrCodeData);
    
    res.json({ 
      success: true,
      qrCode: savedQRCode,
      message: 'QR code created and saved successfully'
    });

  } catch (error) {
    console.error('Error creating QR code:', error);
    res.status(500).json({ error: 'Failed to create QR code' });
  }
});

// Update review link for existing QR code
router.patch('/:locationId/review-link', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { googleReviewLink } = req.body;
    
    if (!googleReviewLink) {
      return res.status(400).json({ error: 'googleReviewLink is required' });
    }

    // Get existing QR code
    const existingQR = await qrStorage.getQRCode(locationId);
    if (!existingQR) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }

    // Update review link
    const updatedQR = await qrStorage.updateReviewLink(locationId, googleReviewLink);
    
    // Regenerate public URL and QR code with new link
    const publicReviewUrl = `${config.frontendUrl}/review/${locationId}?` + 
      `business=${encodeURIComponent(updatedQR.locationName)}&` +
      `location=${encodeURIComponent(updatedQR.address || '')}&` +
      `placeId=${encodeURIComponent(updatedQR.placeId || '')}&` +
      `googleReviewLink=${encodeURIComponent(googleReviewLink)}`;

    const qrCodeUrl = await QRCode.toDataURL(publicReviewUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 512
    });

    // Update with new QR code
    updatedQR.qrCodeUrl = qrCodeUrl;
    updatedQR.publicReviewUrl = publicReviewUrl;
    await qrStorage.saveQRCode(locationId, updatedQR);

    res.json({ 
      success: true,
      qrCode: updatedQR,
      message: 'Review link updated successfully'
    });

  } catch (error) {
    console.error('Error updating review link:', error);
    res.status(500).json({ error: 'Failed to update review link' });
  }
});

// Delete QR code
router.delete('/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const deleted = await qrStorage.deleteQRCode(locationId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }
    
    res.json({ 
      success: true,
      message: 'QR code deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting QR code:', error);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});

// Get QR code statuses for multiple locations
router.post('/statuses', async (req, res) => {
  try {
    const { locationIds } = req.body;
    
    if (!Array.isArray(locationIds)) {
      return res.status(400).json({ error: 'locationIds must be an array' });
    }

    const statuses = await qrStorage.getQRCodeStatuses(locationIds);
    res.json({ statuses });

  } catch (error) {
    console.error('Error fetching QR code statuses:', error);
    res.status(500).json({ error: 'Failed to fetch QR code statuses' });
  }
});

export default router;