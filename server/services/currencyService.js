import fetch from 'node-fetch';

/**
 * Currency Service - Handles live exchange rates and currency conversion
 * Uses exchangerate-api.com (free tier: 1,500 requests/month)
 */
export class CurrencyService {
  constructor() {
    // Using ExchangeRate-API with API key for higher rate limits and reliability
    this.apiKey = process.env.EXCHANGE_RATE_API_KEY || 'c5a029cf315fa4936eb03248';
    this.baseUrl = `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest`;
    this.baseCurrency = 'USD';
    this.cache = {
      rates: null,
      timestamp: null,
      ttl: 6 * 60 * 60 * 1000 // Cache for 6 hours
    };

    console.log('[CurrencyService] Initialized with base currency:', this.baseCurrency);
    console.log('[CurrencyService] Using ExchangeRate-API with authenticated access');
  }

  /**
   * Get live exchange rates from USD to all currencies
   */
  async getExchangeRates(forceRefresh = false) {
    try {
      const now = Date.now();

      // Return cached rates if still valid
      if (!forceRefresh && this.cache.rates && this.cache.timestamp && (now - this.cache.timestamp < this.cache.ttl)) {
        console.log('[CurrencyService] ✅ Using cached exchange rates');
        return this.cache.rates;
      }

      console.log('[CurrencyService] 🔄 Fetching fresh exchange rates from API...');
      const response = await fetch(`${this.baseUrl}/${this.baseCurrency}`);

      if (!response.ok) {
        throw new Error(`Exchange rate API returned ${response.status}`);
      }

      const data = await response.json();

      // Check if API call was successful
      if (data.result !== 'success') {
        throw new Error(`Exchange rate API error: ${data['error-type'] || 'Unknown error'}`);
      }

      // Cache the rates (v6 API uses conversion_rates instead of rates)
      this.cache.rates = data.conversion_rates;
      this.cache.timestamp = now;

      console.log('[CurrencyService] ✅ Exchange rates updated successfully');
      console.log('[CurrencyService] Last update:', data.time_last_update_utc);
      console.log('[CurrencyService] Sample rates:', {
        INR: data.conversion_rates.INR,
        EUR: data.conversion_rates.EUR,
        GBP: data.conversion_rates.GBP,
        AUD: data.conversion_rates.AUD,
        CAD: data.conversion_rates.CAD
      });

      return data.conversion_rates;
    } catch (error) {
      console.error('[CurrencyService] ❌ Error fetching exchange rates:', error.message);

      // Return cached rates if available, even if expired
      if (this.cache.rates) {
        console.warn('[CurrencyService] ⚠️ Using expired cache due to API error');
        return this.cache.rates;
      }

      // Fallback to hardcoded rates if all else fails
      console.warn('[CurrencyService] ⚠️ Using fallback exchange rates');
      return this.getFallbackRates();
    }
  }

  /**
   * Fallback rates in case API is unavailable (updated Nov 2025)
   */
  getFallbackRates() {
    return {
      USD: 1,
      INR: 88.718, // Updated to current rate as of Nov 5, 2025
      EUR: 0.92,
      GBP: 0.79,
      AUD: 1.52,
      CAD: 1.36,
      JPY: 149.50,
      CNY: 7.24,
      SGD: 1.34,
      AED: 3.67
    };
  }

  /**
   * Convert amount from USD to target currency
   */
  async convertFromUSD(amountUSD, targetCurrency) {
    try {
      const rates = await this.getExchangeRates();
      const rate = rates[targetCurrency.toUpperCase()];

      if (!rate) {
        throw new Error(`Unsupported currency: ${targetCurrency}`);
      }

      const convertedAmount = amountUSD * rate;

      console.log(`[CurrencyService] 💱 Converted $${amountUSD} USD → ${convertedAmount.toFixed(2)} ${targetCurrency} (rate: ${rate})`);

      return {
        originalAmount: amountUSD,
        originalCurrency: 'USD',
        convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimals
        targetCurrency: targetCurrency.toUpperCase(),
        exchangeRate: rate,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[CurrencyService] ❌ Conversion error:', error.message);
      throw error;
    }
  }

  /**
   * Get the user's currency based on their country/IP
   * This is a simple mapping - you can enhance with IP geolocation
   */
  getCurrencyByCountry(countryCode) {
    const currencyMap = {
      IN: 'INR',
      US: 'USD',
      GB: 'GBP',
      EU: 'EUR',
      DE: 'EUR',
      FR: 'EUR',
      IT: 'EUR',
      ES: 'EUR',
      AU: 'AUD',
      CA: 'CAD',
      SG: 'SGD',
      AE: 'AED',
      JP: 'JPY',
      CN: 'CNY'
    };

    return currencyMap[countryCode?.toUpperCase()] || 'USD';
  }

  /**
   * Get Razorpay-supported currencies
   * Razorpay supports: INR, USD, EUR, GBP, AUD, CAD, SGD, AED, and more
   */
  getRazorpaySupportedCurrencies() {
    return ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'MYR'];
  }

  /**
   * Check if currency is supported by Razorpay
   */
  isCurrencySupported(currency) {
    return this.getRazorpaySupportedCurrencies().includes(currency.toUpperCase());
  }

  /**
   * Get currency symbol
   */
  getCurrencySymbol(currency) {
    const symbols = {
      USD: '$',
      INR: '₹',
      EUR: '€',
      GBP: '£',
      AUD: 'A$',
      CAD: 'C$',
      SGD: 'S$',
      AED: 'د.إ',
      JPY: '¥',
      CNY: '¥'
    };

    return symbols[currency.toUpperCase()] || currency;
  }

  /**
   * Format amount with currency
   */
  formatAmount(amount, currency) {
    const symbol = this.getCurrencySymbol(currency);
    const formattedAmount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

    return `${symbol}${formattedAmount}`;
  }
}

export default CurrencyService;