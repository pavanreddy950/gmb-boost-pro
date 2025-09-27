import firebaseConfig from '../config/firebase.js';
import { google } from 'googleapis';

class CSVProcessingService {
  constructor() {
    this.db = null;
    this.collection = 'customer_lists';
    this.reviewsCollection = 'review_requests';
    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initialized) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('[CSVProcessingService] Initializing Firestore connection...');
      const { db } = await firebaseConfig.ensureInitialized();
      this.db = db;
      this.initialized = true;
      console.log('[CSVProcessingService] ✅ Firestore connection established');
      return this.db;
    } catch (error) {
      console.error('[CSVProcessingService] ❌ Failed to initialize Firestore:', error.message);
      this.initialized = false;
      this.db = null;
      throw error;
    }
  }

  // Parse CSV file content
  async parseCSVFile(csvContent, userId, locationId) {
    try {
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row');
      }

      const headers = this.parseCSVLine(lines[0]);
      const headerMap = this.mapHeaders(headers);

      if (!headerMap.name || !headerMap.email) {
        throw new Error('CSV must contain at least Name and Email columns');
      }

      const customers = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);

          if (values.length < 2) continue; // Skip empty/invalid rows

          const customer = this.parseCustomerRow(values, headerMap, i + 1);
          if (customer) {
            customers.push(customer);
          }
        } catch (error) {
          errors.push({
            row: i + 1,
            error: error.message
          });
        }
      }

      console.log(`[CSVProcessingService] Parsed ${customers.length} customers from CSV`);

      // Save customer list to database
      const customerListId = await this.saveCustomerList(userId, locationId, customers);

      return {
        customerListId,
        customers,
        totalRows: lines.length - 1,
        successfulRows: customers.length,
        errors,
        headerMap
      };

    } catch (error) {
      console.error('[CSVProcessingService] Error parsing CSV:', error);
      throw error;
    }
  }

  // Parse CSV line handling quotes and commas
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  // Map CSV headers to expected fields
  mapHeaders(headers) {
    const headerMap = {};

    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().trim();

      if (normalized.includes('name') && !normalized.includes('business')) {
        headerMap.name = index;
      } else if (normalized.includes('email')) {
        headerMap.email = index;
      } else if (normalized.includes('phone') || normalized.includes('mobile')) {
        headerMap.phone = index;
      } else if (normalized.includes('company') || normalized.includes('business')) {
        headerMap.company = index;
      } else if (normalized.includes('address')) {
        headerMap.address = index;
      } else if (normalized.includes('city')) {
        headerMap.city = index;
      } else if (normalized.includes('state')) {
        headerMap.state = index;
      } else if (normalized.includes('zip') || normalized.includes('postal')) {
        headerMap.zipCode = index;
      }
    });

    return headerMap;
  }

  // Parse individual customer row
  parseCustomerRow(values, headerMap, rowNumber) {
    const name = values[headerMap.name]?.trim();
    const email = values[headerMap.email]?.trim();

    if (!name || !email) {
      throw new Error(`Missing required fields (name or email) in row ${rowNumber}`);
    }

    // Validate email format
    if (!this.validateEmail(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    const customer = {
      id: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      email,
      rowNumber,
      source: 'csv',
      uploadedAt: new Date().toISOString(),
      hasReviewed: false, // Will be updated by review checking
      reviewDate: null,
      reviewRating: null,
      reviewText: null
    };

    // Add optional fields if present
    if (headerMap.phone && values[headerMap.phone]) {
      customer.phone = this.formatPhoneNumber(values[headerMap.phone].trim());
    }

    if (headerMap.company && values[headerMap.company]) {
      customer.company = values[headerMap.company].trim();
    }

    if (headerMap.address && values[headerMap.address]) {
      customer.address = values[headerMap.address].trim();
    }

    if (headerMap.city && values[headerMap.city]) {
      customer.city = values[headerMap.city].trim();
    }

    if (headerMap.state && values[headerMap.state]) {
      customer.state = values[headerMap.state].trim();
    }

    if (headerMap.zipCode && values[headerMap.zipCode]) {
      customer.zipCode = values[headerMap.zipCode].trim();
    }

    return customer;
  }

  // Check customers against existing Google Business Profile reviews
  async checkCustomerReviews(customers, locationId, accessToken) {
    if (!accessToken) {
      console.warn('[CSVProcessingService] No access token provided, skipping review checking');
      return customers;
    }

    try {
      console.log(`[CSVProcessingService] Checking reviews for ${customers.length} customers`);

      // Get reviews from Google Business Profile
      const reviews = await this.getLocationReviews(locationId, accessToken);

      if (!reviews || reviews.length === 0) {
        console.log('[CSVProcessingService] No reviews found for location');
        return customers;
      }

      console.log(`[CSVProcessingService] Found ${reviews.length} reviews to check against`);

      // Create email-to-review mapping
      const reviewsByEmail = new Map();
      const reviewsByName = new Map();

      reviews.forEach(review => {
        // Google reviews may not always have email, so we'll try to match by name too
        if (review.reviewer && review.reviewer.displayName) {
          const reviewerName = review.reviewer.displayName.toLowerCase().trim();
          reviewsByName.set(reviewerName, review);
        }
      });

      // Check each customer against reviews
      const updatedCustomers = customers.map(customer => {
        const customerNameLower = customer.name.toLowerCase().trim();

        // Try to find matching review by name (most common case for Google reviews)
        let matchingReview = reviewsByName.get(customerNameLower);

        if (!matchingReview) {
          // Try partial name matching
          for (const [reviewerName, review] of reviewsByName) {
            if (this.isNameMatch(customerNameLower, reviewerName)) {
              matchingReview = review;
              break;
            }
          }
        }

        if (matchingReview) {
          return {
            ...customer,
            hasReviewed: true,
            reviewDate: matchingReview.createTime,
            reviewRating: matchingReview.starRating || 5,
            reviewText: matchingReview.comment || '',
            reviewId: matchingReview.name,
            matchedBy: 'name'
          };
        }

        return customer;
      });

      const reviewedCount = updatedCustomers.filter(c => c.hasReviewed).length;
      console.log(`[CSVProcessingService] Found ${reviewedCount} customers who have already reviewed`);

      return updatedCustomers;

    } catch (error) {
      console.error('[CSVProcessingService] Error checking customer reviews:', error);
      // Return original customers if review checking fails
      return customers;
    }
  }

  // Get reviews from Google Business Profile API
  async getLocationReviews(locationId, accessToken) {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const mybusiness = google.mybusinessbusinessinformation({
        version: 'v1',
        auth: auth
      });

      // Get reviews for the location
      const response = await mybusiness.locations.get({
        name: `locations/${locationId}`,
        readMask: 'reviews'
      });

      return response.data.reviews || [];

    } catch (error) {
      console.error('[CSVProcessingService] Error fetching reviews from Google API:', error);

      // Fallback: try alternative API endpoint
      try {
        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}/reviews`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          return data.reviews || [];
        }
      } catch (fallbackError) {
        console.error('[CSVProcessingService] Fallback API also failed:', fallbackError);
      }

      return [];
    }
  }

  // Check if two names match (fuzzy matching)
  isNameMatch(name1, name2) {
    // Simple fuzzy matching - can be enhanced with more sophisticated algorithms
    const normalize = (str) => str.toLowerCase().replace(/[^a-z\s]/g, '').trim();

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Exact match
    if (n1 === n2) return true;

    // Check if one name contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // Check individual words
    const words1 = n1.split(/\s+/);
    const words2 = n2.split(/\s+/);

    // If both names have at least 2 words and at least 2 words match
    if (words1.length >= 2 && words2.length >= 2) {
      const matches = words1.filter(word => words2.includes(word)).length;
      return matches >= 2;
    }

    return false;
  }

  // Save customer list to database
  async saveCustomerList(userId, locationId, customers) {
    await this.initialize();

    const customerListDoc = {
      id: `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      locationId,
      customers,
      totalCustomers: customers.length,
      reviewedCustomers: customers.filter(c => c.hasReviewed).length,
      pendingCustomers: customers.filter(c => !c.hasReviewed).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.db.collection(this.collection).doc(customerListDoc.id).set(customerListDoc);

    console.log(`[CSVProcessingService] Saved customer list ${customerListDoc.id}`);
    return customerListDoc.id;
  }

  // Get customer list by ID
  async getCustomerList(customerListId, userId) {
    await this.initialize();

    const doc = await this.db.collection(this.collection).doc(customerListId).get();

    if (!doc.exists) {
      throw new Error('Customer list not found');
    }

    const data = doc.data();

    // Verify ownership
    if (data.userId !== userId) {
      throw new Error('Unauthorized access to customer list');
    }

    return data;
  }

  // Get all customer lists for a user
  async getUserCustomerLists(userId, locationId = null) {
    await this.initialize();

    let query = this.db.collection(this.collection)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');

    if (locationId) {
      query = query.where('locationId', '==', locationId);
    }

    const snapshot = await query.get();

    const customerLists = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Don't return full customer data, just summary
      customerLists.push({
        id: data.id,
        locationId: data.locationId,
        totalCustomers: data.totalCustomers,
        reviewedCustomers: data.reviewedCustomers,
        pendingCustomers: data.pendingCustomers,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });

    return customerLists;
  }

  // Generate analysis from customer data
  generateAnalysis(customers) {
    const total = customers.length;
    const reviewed = customers.filter(c => c.hasReviewed).length;
    const pending = total - reviewed;

    // Calculate average rating for reviewed customers
    const reviewedCustomers = customers.filter(c => c.hasReviewed && c.reviewRating);
    const averageRating = reviewedCustomers.length > 0
      ? reviewedCustomers.reduce((sum, c) => sum + c.reviewRating, 0) / reviewedCustomers.length
      : 0;

    return {
      totalCustomers: total,
      reviewedCustomers: reviewed,
      pendingReviews: pending,
      averageRating: Number(averageRating.toFixed(1)),
      completionRate: Number(((reviewed / total) * 100).toFixed(1)),
      customersWithPhone: customers.filter(c => c.phone).length,
      customersWithEmail: customers.filter(c => c.email).length
    };
  }

  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Format phone number
  formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Add country code if not present (default to India +91)
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('91')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  // Delete customer list
  async deleteCustomerList(customerListId, userId) {
    await this.initialize();

    const doc = await this.db.collection(this.collection).doc(customerListId).get();

    if (!doc.exists) {
      throw new Error('Customer list not found');
    }

    const data = doc.data();

    // Verify ownership
    if (data.userId !== userId) {
      throw new Error('Unauthorized access to customer list');
    }

    await this.db.collection(this.collection).doc(customerListId).delete();

    console.log(`[CSVProcessingService] Deleted customer list ${customerListId}`);
  }

  // Update customer review status
  async updateCustomerReviewStatus(customerListId, customerId, reviewData) {
    await this.initialize();

    const doc = await this.db.collection(this.collection).doc(customerListId).get();

    if (!doc.exists) {
      throw new Error('Customer list not found');
    }

    const data = doc.data();
    const customers = data.customers;

    // Find and update the customer
    const customerIndex = customers.findIndex(c => c.id === customerId);
    if (customerIndex === -1) {
      throw new Error('Customer not found in list');
    }

    customers[customerIndex] = {
      ...customers[customerIndex],
      ...reviewData,
      updatedAt: new Date().toISOString()
    };

    // Recalculate statistics
    const reviewedCustomers = customers.filter(c => c.hasReviewed).length;

    await this.db.collection(this.collection).doc(customerListId).update({
      customers,
      reviewedCustomers,
      pendingCustomers: customers.length - reviewedCustomers,
      updatedAt: new Date().toISOString()
    });

    console.log(`[CSVProcessingService] Updated customer ${customerId} review status`);
  }
}

export default CSVProcessingService;