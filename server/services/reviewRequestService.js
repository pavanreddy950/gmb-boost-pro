import supabaseConfig from '../config/supabase.js';
import gmailPoolService from './gmailPoolService.js';

/**
 * Review Request Service
 * Handles file parsing, customer management, email tracking, and review matching
 *
 * Features:
 * - CSV/Excel file parsing with flexible column detection
 * - Customer data normalization and deduplication
 * - Email tracking (open, click)
 * - Review matching with fuzzy name comparison
 */
class ReviewRequestService {
  constructor() {
    this.supabase = null;
  }

  async getSupabase() {
    if (!this.supabase) {
      this.supabase = await supabaseConfig.ensureInitialized();
    }
    return this.supabase;
  }

  // ============================================
  // FILE PARSING
  // ============================================

  /**
   * Parse uploaded file (CSV or Excel)
   */
  async parseFile(fileBuffer, fileName, fileType) {
    const ext = fileName?.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || fileType === 'text/csv' || fileType === 'application/vnd.ms-excel') {
      return this.parseCSV(fileBuffer.toString('utf-8'));
    } else if (['xlsx', 'xls'].includes(ext) || fileType?.includes('spreadsheet')) {
      return this.parseExcel(fileBuffer);
    }

    throw new Error(`Unsupported file type: ${ext}. Please upload CSV or Excel files.`);
  }

  /**
   * Parse CSV content
   */
  async parseCSV(csvContent) {
    // Dynamic import for papaparse
    const Papa = (await import('papaparse')).default;

    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: (results) => {
          const customers = this.normalizeCustomerData(results.data);
          resolve({
            customers,
            totalRows: results.data.length,
            validRows: customers.length,
            errors: results.errors
          });
        },
        error: (error) => reject(new Error(`CSV parsing failed: ${error.message}`))
      });
    });
  }

  /**
   * Parse Excel file
   */
  async parseExcel(fileBuffer) {
    // Dynamic import for xlsx
    const XLSX = await import('xlsx');

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      throw new Error('Excel file is empty or has no data rows');
    }

    // Get headers from first row
    const headers = data[0].map(h => String(h || '').trim().toLowerCase());

    // Convert rows to objects
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] !== undefined ? String(row[index]) : '';
      });
      return obj;
    });

    const customers = this.normalizeCustomerData(rows);

    return {
      customers,
      totalRows: rows.length,
      validRows: customers.length,
      errors: []
    };
  }

  /**
   * Normalize customer data from parsed rows
   * Handles various column name formats
   */
  normalizeCustomerData(rows) {
    const customers = [];
    const seenEmails = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Find fields with flexible column name matching
      const name = this.findField(row, ['name', 'customer_name', 'full_name', 'customer', 'client_name', 'client']);
      const email = this.findField(row, ['email', 'customer_email', 'email_address', 'mail', 'e-mail', 'emailaddress']);
      const phone = this.findField(row, ['phone', 'mobile', 'telephone', 'phone_number', 'phonenumber', 'cell', 'contact']);

      // Validate email
      if (!email || !this.isValidEmail(email)) {
        continue;
      }

      // Deduplicate by email
      const emailLower = email.toLowerCase().trim();
      if (seenEmails.has(emailLower)) {
        continue;
      }
      seenEmails.add(emailLower);

      customers.push({
        name: name?.trim() || 'Customer',
        email: emailLower,
        phone: phone?.trim() || null,
        rowNumber: i + 2 // +2 because row 1 is header, and array is 0-indexed
      });
    }

    return customers;
  }

  /**
   * Case-insensitive field finder
   * Tries multiple possible column names
   */
  findField(row, possibleNames) {
    const rowKeys = Object.keys(row);

    for (const possibleName of possibleNames) {
      // Direct match
      if (row[possibleName] !== undefined && row[possibleName] !== '') {
        return String(row[possibleName]);
      }

      // Normalized match (remove underscores, spaces)
      const lowerPossibleName = possibleName.toLowerCase().replace(/[_\s-]/g, '');
      for (const key of rowKeys) {
        const lowerKey = key.toLowerCase().replace(/[_\s-]/g, '');
        if (lowerKey === lowerPossibleName && row[key] !== undefined && row[key] !== '') {
          return String(row[key]);
        }
      }
    }

    return null;
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // ============================================
  // UPLOAD & PROCESS
  // ============================================

  /**
   * Upload and process a customer file
   */
  async uploadAndProcess({ userId, locationId, locationName, businessName, fileBuffer, fileName, fileType, reviewLink }) {
    const supabase = await this.getSupabase();

    // Parse the file
    const { customers, totalRows, validRows } = await this.parseFile(fileBuffer, fileName, fileType);

    if (customers.length === 0) {
      throw new Error('No valid customer data found. Ensure your file has Name and Email columns.');
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('review_request_batches')
      .insert({
        user_id: userId,
        location_id: locationId,
        location_name: locationName,
        business_name: businessName,
        file_name: fileName,
        file_type: fileName.split('.').pop()?.toLowerCase(),
        file_size: fileBuffer.length,
        total_customers: totalRows,
        valid_customers: validRows,
        status: 'processing'
      })
      .select()
      .single();

    if (batchError) {
      console.error('[ReviewRequest] Failed to create batch:', batchError);
      throw new Error('Failed to create upload batch');
    }

    // Check for existing customers to avoid duplicates
    const { data: existingCustomers } = await supabase
      .from('review_requests')
      .select('customer_email')
      .eq('user_id', userId)
      .eq('location_id', locationId);

    const existingEmails = new Set((existingCustomers || []).map(c => c.customer_email.toLowerCase()));

    // Filter out duplicates
    const newCustomers = customers.filter(c => !existingEmails.has(c.email.toLowerCase()));
    const duplicateCount = customers.length - newCustomers.length;

    // Insert new customers
    if (newCustomers.length > 0) {
      const customerRecords = newCustomers.map(c => ({
        user_id: userId,
        location_id: locationId,
        location_name: locationName,
        business_name: businessName,
        customer_name: c.name,
        customer_email: c.email,
        customer_phone: c.phone,
        upload_batch_id: batch.id,
        original_file_name: fileName,
        row_number: c.rowNumber,
        review_link: reviewLink,
        email_status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('review_requests')
        .insert(customerRecords);

      if (insertError) {
        console.error('[ReviewRequest] Failed to insert customers:', insertError);
        throw new Error('Failed to save customer data');
      }
    }

    // Update batch stats
    await supabase
      .from('review_request_batches')
      .update({
        valid_customers: newCustomers.length,
        duplicate_customers: duplicateCount,
        emails_pending: newCustomers.length,
        status: 'analyzed'
      })
      .eq('id', batch.id);

    console.log(`[ReviewRequest] ✅ Uploaded ${newCustomers.length} new customers (${duplicateCount} duplicates skipped)`);

    return {
      batchId: batch.id,
      totalRows,
      validCustomers: customers.length,
      newCustomers: newCustomers.length,
      duplicates: duplicateCount
    };
  }

  // ============================================
  // SEND EMAILS
  // ============================================

  /**
   * Send review request emails to customers
   */
  async sendReviewRequests({ userId, locationId, customerIds, businessName, reviewLink, customSenderName }) {
    const supabase = await this.getSupabase();

    // Build query for customers to email
    let query = supabase
      .from('review_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .eq('has_reviewed', false)
      .in('email_status', ['pending', 'failed']); // Include failed for retry

    if (customerIds && customerIds.length > 0) {
      query = query.in('id', customerIds);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[ReviewRequest] Failed to fetch customers:', error);
      throw new Error('Failed to fetch customers');
    }

    if (!customers || customers.length === 0) {
      throw new Error('No customers found to send review requests. All customers may have already received emails or left reviews.');
    }

    // Get tracking base URL
    const trackingBaseUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';

    // Send emails via Gmail Pool Service
    const results = await gmailPoolService.sendBulkReviewRequests({
      customers: customers.map(c => ({
        id: c.id,
        name: c.customer_name,
        email: c.customer_email
      })),
      businessName: businessName || customers[0].business_name,
      reviewLink: reviewLink || customers[0].review_link,
      customSenderName,
      trackingBaseUrl
    });

    // Update customer records with send results
    for (const result of results.results) {
      const updateData = {
        email_status: result.success ? 'sent' : 'failed',
        email_sent_at: result.success ? new Date().toISOString() : null,
        email_sent_from: result.sentFrom || null,
        email_message_id: result.messageId || null,
        email_error: result.error || null,
        request_count: supabase.raw ? supabase.raw('request_count + 1') : 1,
        last_request_sent_at: new Date().toISOString()
      };

      await supabase
        .from('review_requests')
        .update(updateData)
        .eq('id', result.customerId);
    }

    // Update batch stats if we have a batch ID
    if (customers[0]?.upload_batch_id) {
      const batchId = customers[0].upload_batch_id;
      const { data: batchCustomers } = await supabase
        .from('review_requests')
        .select('email_status')
        .eq('upload_batch_id', batchId);

      if (batchCustomers) {
        const sent = batchCustomers.filter(c => c.email_status === 'sent').length;
        const failed = batchCustomers.filter(c => c.email_status === 'failed').length;
        const pending = batchCustomers.filter(c => c.email_status === 'pending').length;

        await supabase
          .from('review_request_batches')
          .update({
            emails_sent: sent,
            emails_failed: failed,
            emails_pending: pending,
            status: pending === 0 ? 'completed' : 'sending'
          })
          .eq('id', batchId);
      }
    }

    console.log(`[ReviewRequest] ✅ Sent ${results.sent} emails, ${results.failed} failed`);

    return results;
  }

  // ============================================
  // EMAIL TRACKING
  // ============================================

  /**
   * Track email open (called when tracking pixel loads)
   */
  async trackEmailOpen(customerId) {
    const supabase = await this.getSupabase();

    // Only update if not already opened
    const { error } = await supabase
      .from('review_requests')
      .update({ email_opened_at: new Date().toISOString() })
      .eq('id', customerId)
      .is('email_opened_at', null);

    if (!error) {
      console.log(`[ReviewRequest] 📧 Email opened: ${customerId}`);
    }
  }

  /**
   * Track link click (called when review link is clicked)
   * Returns the actual review link to redirect to
   */
  async trackLinkClick(customerId) {
    const supabase = await this.getSupabase();

    // Get customer's review link
    const { data: customer } = await supabase
      .from('review_requests')
      .select('review_link, email_clicked_at')
      .eq('id', customerId)
      .single();

    // Only update if not already clicked
    if (customer && !customer.email_clicked_at) {
      await supabase
        .from('review_requests')
        .update({ email_clicked_at: new Date().toISOString() })
        .eq('id', customerId);

      console.log(`[ReviewRequest] 🖱️ Link clicked: ${customerId}`);
    }

    return customer?.review_link || null;
  }

  /**
   * Get tracking statistics for a location
   */
  async getTrackingStats({ userId, locationId }) {
    const supabase = await this.getSupabase();

    const { data: customers } = await supabase
      .from('review_requests')
      .select('email_status, email_opened_at, email_clicked_at, has_reviewed')
      .eq('user_id', userId)
      .eq('location_id', locationId);

    if (!customers || customers.length === 0) {
      return {
        totalCustomers: 0,
        totalSent: 0,
        opened: 0,
        clicked: 0,
        reviewed: 0,
        openRate: 0,
        clickRate: 0,
        reviewRate: 0,
        clickToReviewRate: 0
      };
    }

    const sent = customers.filter(c => c.email_status === 'sent');
    const totalSent = sent.length;
    const opened = sent.filter(c => c.email_opened_at).length;
    const clicked = sent.filter(c => c.email_clicked_at).length;
    const reviewed = customers.filter(c => c.has_reviewed).length;

    return {
      totalCustomers: customers.length,
      totalSent,
      opened,
      clicked,
      reviewed,
      openRate: totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0,
      clickRate: totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0,
      reviewRate: totalSent > 0 ? Math.round((reviewed / totalSent) * 100) : 0,
      clickToReviewRate: clicked > 0 ? Math.round((reviewed / clicked) * 100) : 0
    };
  }

  // ============================================
  // REVIEW MATCHING (Fuzzy Name Matching)
  // ============================================

  /**
   * Match Google reviews with customers who were sent emails
   */
  async matchReviewsWithCustomers({ userId, locationId, reviews }) {
    const supabase = await this.getSupabase();

    // Get customers who have been sent emails but haven't reviewed
    const { data: pendingCustomers } = await supabase
      .from('review_requests')
      .select('id, customer_name, customer_email')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .eq('email_status', 'sent')
      .eq('has_reviewed', false);

    if (!pendingCustomers || pendingCustomers.length === 0) {
      return { matched: 0, total: reviews?.length || 0, matchedCustomers: [] };
    }

    let matchedCount = 0;
    const matchedCustomers = [];
    const remainingCustomers = [...pendingCustomers];

    for (const review of (reviews || [])) {
      const reviewerName = review.reviewer?.displayName || review.reviewerName || review.author_name || '';

      if (!reviewerName) continue;

      const normalizedReviewerName = this.normalizeName(reviewerName);

      // Find matching customer
      for (let i = 0; i < remainingCustomers.length; i++) {
        const customer = remainingCustomers[i];
        const normalizedCustomerName = this.normalizeName(customer.customer_name);

        if (this.namesMatch(normalizedReviewerName, normalizedCustomerName)) {
          // Update customer record
          await supabase
            .from('review_requests')
            .update({
              has_reviewed: true,
              review_date: review.createTime || review.time || new Date().toISOString(),
              review_rating: this.parseStarRating(review.starRating) || review.rating,
              review_text: review.comment || review.text || null
            })
            .eq('id', customer.id);

          matchedCount++;
          matchedCustomers.push({
            customerId: customer.id,
            customerName: customer.customer_name,
            reviewerName: reviewerName,
            rating: this.parseStarRating(review.starRating) || review.rating
          });

          // Remove from remaining list
          remainingCustomers.splice(i, 1);
          break;
        }
      }
    }

    console.log(`[ReviewRequest] 🔄 Matched ${matchedCount} reviews with customers`);

    return {
      matched: matchedCount,
      total: reviews?.length || 0,
      matchedCustomers
    };
  }

  /**
   * Normalize name for comparison
   * - Lowercase
   * - Replace dots with spaces ("reddy.k" → "reddy k")
   * - Remove special characters
   * - Normalize whitespace
   */
  normalizeName(name) {
    if (!name) return '';

    return name
      .toLowerCase()
      .trim()
      .replace(/\./g, ' ')           // dots to spaces
      .replace(/[^a-z0-9\s]/g, '')   // remove special chars
      .replace(/\s+/g, ' ')          // normalize whitespace
      .trim();
  }

  /**
   * Fuzzy name matching
   * Handles variations like:
   * - "Pavan Reddy.k" = "pavan reddy k"
   * - "John Smith" = "John S."
   * - "Ram Kumar" = "Ram K"
   */
  namesMatch(name1, name2) {
    if (!name1 || !name2) return false;

    // Exact match
    if (name1 === name2) return true;

    // Compact comparison (no spaces)
    if (name1.replace(/\s/g, '') === name2.replace(/\s/g, '')) return true;

    const parts1 = name1.split(' ').filter(p => p.length > 0);
    const parts2 = name2.split(' ').filter(p => p.length > 0);

    // First name match + similar last name
    if (parts1[0] === parts2[0]) {
      // If first names match and are distinctive (4+ chars), likely same person
      if (parts1[0].length >= 4) return true;

      // Check last names
      if (parts1.length > 1 && parts2.length > 1) {
        const last1 = parts1[parts1.length - 1];
        const last2 = parts2[parts2.length - 1];

        // Exact last name match or one contains the other
        if (last1 === last2 || last1.includes(last2) || last2.includes(last1)) {
          return true;
        }
      }
    }

    // One name contains the other
    if (name1.includes(name2) || name2.includes(name1)) return true;

    return false;
  }

  /**
   * Parse Google's star rating format
   */
  parseStarRating(starRating) {
    if (typeof starRating === 'number') return starRating;

    const map = {
      'ONE': 1,
      'TWO': 2,
      'THREE': 3,
      'FOUR': 4,
      'FIVE': 5
    };

    return map[starRating] || parseInt(starRating) || null;
  }

  // ============================================
  // GETTERS
  // ============================================

  /**
   * Get customers for a location
   */
  async getCustomers({ userId, locationId, status, batchId, limit = 100, offset = 0 }) {
    const supabase = await this.getSupabase();

    let query = supabase
      .from('review_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'pending') {
      query = query.eq('has_reviewed', false);
    } else if (status === 'reviewed') {
      query = query.eq('has_reviewed', true);
    } else if (status === 'sent') {
      query = query.eq('email_status', 'sent');
    } else if (status === 'not_sent') {
      query = query.eq('email_status', 'pending');
    }

    if (batchId) {
      query = query.eq('upload_batch_id', batchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ReviewRequest] Failed to get customers:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get batch history for a location
   */
  async getBatchHistory({ userId, locationId }) {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from('review_request_batches')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ReviewRequest] Failed to get batches:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get location statistics
   */
  async getLocationStats({ userId, locationId }) {
    const supabase = await this.getSupabase();

    const { data: customers } = await supabase
      .from('review_requests')
      .select('email_status, has_reviewed, email_opened_at, email_clicked_at')
      .eq('user_id', userId)
      .eq('location_id', locationId);

    if (!customers || customers.length === 0) {
      return {
        totalCustomers: 0,
        pendingReviews: 0,
        reviewed: 0,
        emailsSent: 0,
        emailsPending: 0,
        emailsFailed: 0,
        emailsOpened: 0,
        emailsClicked: 0
      };
    }

    return {
      totalCustomers: customers.length,
      pendingReviews: customers.filter(c => !c.has_reviewed).length,
      reviewed: customers.filter(c => c.has_reviewed).length,
      emailsSent: customers.filter(c => c.email_status === 'sent').length,
      emailsPending: customers.filter(c => c.email_status === 'pending').length,
      emailsFailed: customers.filter(c => c.email_status === 'failed').length,
      emailsOpened: customers.filter(c => c.email_opened_at).length,
      emailsClicked: customers.filter(c => c.email_clicked_at).length
    };
  }

  // ============================================
  // DELETE OPERATIONS
  // ============================================

  /**
   * Delete a batch and all its customers
   */
  async deleteBatch({ userId, batchId }) {
    const supabase = await this.getSupabase();

    // Delete customers first
    await supabase
      .from('review_requests')
      .delete()
      .eq('upload_batch_id', batchId)
      .eq('user_id', userId);

    // Delete batch
    await supabase
      .from('review_request_batches')
      .delete()
      .eq('id', batchId)
      .eq('user_id', userId);

    console.log(`[ReviewRequest] 🗑️ Deleted batch ${batchId}`);

    return { success: true };
  }

  /**
   * Delete a single customer
   */
  async deleteCustomer({ userId, customerId }) {
    const supabase = await this.getSupabase();

    await supabase
      .from('review_requests')
      .delete()
      .eq('id', customerId)
      .eq('user_id', userId);

    console.log(`[ReviewRequest] 🗑️ Deleted customer ${customerId}`);

    return { success: true };
  }

  /**
   * Delete all customers for a location
   */
  async deleteAllCustomers({ userId, locationId }) {
    const supabase = await this.getSupabase();

    // Delete all customers
    await supabase
      .from('review_requests')
      .delete()
      .eq('user_id', userId)
      .eq('location_id', locationId);

    // Delete all batches
    await supabase
      .from('review_request_batches')
      .delete()
      .eq('user_id', userId)
      .eq('location_id', locationId);

    console.log(`[ReviewRequest] 🗑️ Deleted all customers for location ${locationId}`);

    return { success: true };
  }
}

const reviewRequestService = new ReviewRequestService();
export default reviewRequestService;
