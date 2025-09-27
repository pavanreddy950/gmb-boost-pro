import fs from 'fs/promises';
import path from 'path';

class QRCodeStorageService {
  constructor() {
    this.dataFile = path.join(process.cwd(), 'data', 'qrCodes.json');
    this.qrCodes = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dataFile);
      await fs.mkdir(dataDir, { recursive: true });

      // Load existing QR codes
      try {
        const data = await fs.readFile(this.dataFile, 'utf8');
        const qrData = JSON.parse(data);
        
        // Convert to Map
        for (const [locationId, qrInfo] of Object.entries(qrData.qrCodes || {})) {
          this.qrCodes.set(locationId, qrInfo);
        }
        
        console.log(`[QRCodeStorage] Loaded ${this.qrCodes.size} QR codes from storage`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('[QRCodeStorage] Error loading QR codes:', error);
        } else {
          console.log('[QRCodeStorage] No existing QR codes file found, starting fresh');
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('[QRCodeStorage] Initialization error:', error);
    }
  }

  async saveQRCode(locationId, qrCodeData) {
    await this.initialize();
    
    const qrInfo = {
      locationId,
      locationName: qrCodeData.locationName,
      address: qrCodeData.address,
      placeId: qrCodeData.placeId,
      googleReviewLink: qrCodeData.googleReviewLink,
      qrCodeUrl: qrCodeData.qrCodeUrl,
      publicReviewUrl: qrCodeData.publicReviewUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.qrCodes.set(locationId, qrInfo);
    await this.persistToFile();
    
    console.log(`[QRCodeStorage] Saved QR code for location: ${locationId} (${qrCodeData.locationName})`);
    return qrInfo;
  }

  async getQRCode(locationId) {
    await this.initialize();
    return this.qrCodes.get(locationId) || null;
  }

  async getAllQRCodes(userId = 'default') {
    await this.initialize();
    // Return all QR codes as array
    return Array.from(this.qrCodes.values());
  }

  async updateReviewLink(locationId, googleReviewLink) {
    await this.initialize();
    
    const existing = this.qrCodes.get(locationId);
    if (existing) {
      existing.googleReviewLink = googleReviewLink;
      existing.updatedAt = new Date().toISOString();
      
      await this.persistToFile();
      console.log(`[QRCodeStorage] Updated review link for location: ${locationId}`);
      return existing;
    }
    
    return null;
  }

  async deleteQRCode(locationId) {
    await this.initialize();
    
    const deleted = this.qrCodes.delete(locationId);
    if (deleted) {
      await this.persistToFile();
      console.log(`[QRCodeStorage] Deleted QR code for location: ${locationId}`);
    }
    
    return deleted;
  }

  async persistToFile() {
    try {
      const data = {
        lastUpdated: new Date().toISOString(),
        qrCodes: Object.fromEntries(this.qrCodes)
      };
      
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('[QRCodeStorage] Error saving to file:', error);
    }
  }

  // Helper method to check if location has QR code
  async hasQRCode(locationId) {
    await this.initialize();
    return this.qrCodes.has(locationId);
  }

  // Get QR code status for multiple locations
  async getQRCodeStatuses(locationIds) {
    await this.initialize();
    
    const statuses = {};
    for (const locationId of locationIds) {
      const qrData = this.qrCodes.get(locationId);
      statuses[locationId] = {
        hasQRCode: !!qrData,
        hasReviewLink: !!(qrData?.googleReviewLink),
        createdAt: qrData?.createdAt || null,
        locationName: qrData?.locationName || null
      };
    }
    
    return statuses;
  }
}

export default QRCodeStorageService;