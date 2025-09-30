import fetch from 'node-fetch';

/**
 * Geolocation utility to detect user's country and currency
 */
export class GeolocationService {
  constructor() {
    this.ipApiUrl = 'http://ip-api.com/json';
    this.cache = new Map();
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get user's location info by IP address
   */
  async getLocationByIP(ipAddress) {
    try {
      // Check cache first
      const cached = this.cache.get(ipAddress);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        console.log(`[Geolocation] Using cached data for IP ${ipAddress}`);
        return cached.data;
      }

      // For localhost/private IPs, return default
      if (!ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
        console.log('[Geolocation] Local IP detected, using default location (India)');
        return {
          country: 'India',
          countryCode: 'IN',
          currency: 'INR',
          timezone: 'Asia/Kolkata'
        };
      }

      console.log(`[Geolocation] Fetching location for IP: ${ipAddress}`);
      const response = await fetch(`${this.ipApiUrl}/${ipAddress}`);

      if (!response.ok) {
        throw new Error(`IP API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'fail') {
        throw new Error(data.message || 'Failed to get location');
      }

      const locationData = {
        country: data.country,
        countryCode: data.countryCode,
        currency: this.getCurrencyByCountryCode(data.countryCode),
        timezone: data.timezone,
        city: data.city,
        region: data.regionName
      };

      // Cache the result
      this.cache.set(ipAddress, {
        data: locationData,
        timestamp: Date.now()
      });

      console.log(`[Geolocation] ✅ Detected location:`, locationData);
      return locationData;

    } catch (error) {
      console.error('[Geolocation] Error:', error.message);

      // Return default location on error
      return {
        country: 'India',
        countryCode: 'IN',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      };
    }
  }

  /**
   * Get user's IP from request
   */
  getClientIP(req) {
    // Try various headers that might contain the real IP
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIP = req.headers['x-real-ip'];
    if (realIP) {
      return realIP;
    }

    const cfConnectingIP = req.headers['cf-connecting-ip'];
    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    // Fallback to socket IP
    return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  }

  /**
   * Map country code to currency
   */
  getCurrencyByCountryCode(countryCode) {
    const currencyMap = {
      IN: 'INR',
      US: 'USD',
      GB: 'GBP',
      DE: 'EUR',
      FR: 'EUR',
      IT: 'EUR',
      ES: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      AT: 'EUR',
      PT: 'EUR',
      IE: 'EUR',
      AU: 'AUD',
      CA: 'CAD',
      SG: 'SGD',
      AE: 'AED',
      JP: 'JPY',
      CN: 'CNY',
      MY: 'MYR',
      NZ: 'USD',
      ZA: 'USD',
      BR: 'USD',
      MX: 'USD'
    };

    return currencyMap[countryCode?.toUpperCase()] || 'USD';
  }
}

export default GeolocationService;