import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIT_RESULTS_FILE = path.join(__dirname, '../data/auditResults.json');

class AuditResultsService {
  constructor() {
    this.initializeFile();
  }

  async initializeFile() {
    try {
      await fs.access(AUDIT_RESULTS_FILE);
    } catch {
      // File doesn't exist, create it
      const dataDir = path.dirname(AUDIT_RESULTS_FILE);
      try {
        await fs.access(dataDir);
      } catch {
        await fs.mkdir(dataDir, { recursive: true });
      }
      await fs.writeFile(AUDIT_RESULTS_FILE, JSON.stringify([], null, 2));
    }
  }

  async loadResults() {
    try {
      const data = await fs.readFile(AUDIT_RESULTS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading audit results:', error);
      return [];
    }
  }

  async saveResults(results) {
    try {
      await fs.writeFile(AUDIT_RESULTS_FILE, JSON.stringify(results, null, 2));
    } catch (error) {
      console.error('Error saving audit results:', error);
    }
  }

  /**
   * Save a user's audit result
   * @param {Object} auditData - The audit data to save
   * @param {string} auditData.userId - User's Firebase UID
   * @param {string} auditData.userEmail - User's email
   * @param {string} auditData.locationId - Google Business Profile location ID
   * @param {string} auditData.locationName - Location/business name
   * @param {Object} auditData.performance - Performance metrics
   * @param {Object} auditData.recommendations - AI recommendations
   * @param {Object} auditData.score - Audit scores
   * @param {Object} auditData.dateRange - Date range for the audit
   */
  async saveAuditResult(auditData) {
    const results = await this.loadResults();

    const newResult = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: auditData.userId,
      userEmail: auditData.userEmail,
      locationId: auditData.locationId,
      locationName: auditData.locationName,
      performance: auditData.performance || {},
      recommendations: auditData.recommendations || {},
      score: auditData.score || {},
      dateRange: auditData.dateRange || {},
      timestamp: new Date().toISOString(),
      metadata: auditData.metadata || {},
    };

    // Remove old results for this user+location combination (keep only latest)
    const filteredResults = results.filter(
      result => !(result.userId === auditData.userId && result.locationId === auditData.locationId)
    );

    filteredResults.unshift(newResult); // Add to beginning

    // Keep only last 1000 results to prevent file from growing too large
    if (filteredResults.length > 1000) {
      filteredResults.splice(1000);
    }

    await this.saveResults(filteredResults);
    return newResult;
  }

  /**
   * Get audit results with optional filtering
   * @param {Object} options - Filter options
   * @param {string} options.userId - Filter by user ID
   * @param {string} options.locationId - Filter by location ID
   * @param {number} options.limit - Maximum number of results to return
   * @param {number} options.offset - Number of results to skip
   * @param {string} options.startDate - Filter by start date (ISO string)
   * @param {string} options.endDate - Filter by end date (ISO string)
   */
  async getAuditResults(options = {}) {
    const results = await this.loadResults();
    let filteredResults = [...results];

    // Apply filters
    if (options.userId) {
      filteredResults = filteredResults.filter(result => result.userId === options.userId);
    }

    if (options.locationId) {
      filteredResults = filteredResults.filter(result => result.locationId === options.locationId);
    }

    if (options.startDate) {
      const startDate = new Date(options.startDate);
      filteredResults = filteredResults.filter(result => new Date(result.timestamp) >= startDate);
    }

    if (options.endDate) {
      const endDate = new Date(options.endDate);
      filteredResults = filteredResults.filter(result => new Date(result.timestamp) <= endDate);
    }

    // Apply pagination
    const offset = parseInt(options.offset) || 0;
    const limit = parseInt(options.limit) || 100;
    const paginatedResults = filteredResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: filteredResults.length,
      offset,
      limit,
    };
  }

  /**
   * Get all audit results grouped by user
   */
  async getAllAuditsByUser() {
    const results = await this.loadResults();
    const grouped = {};

    results.forEach(result => {
      if (!grouped[result.userId]) {
        grouped[result.userId] = {
          userId: result.userId,
          userEmail: result.userEmail,
          audits: []
        };
      }
      grouped[result.userId].audits.push(result);
    });

    return Object.values(grouped);
  }

  /**
   * Get latest audit for a specific user and location
   */
  async getLatestAudit(userId, locationId) {
    const results = await this.loadResults();

    const userLocationResults = results.filter(
      result => result.userId === userId && result.locationId === locationId
    );

    if (userLocationResults.length === 0) {
      return null;
    }

    // Already sorted by timestamp (newest first)
    return userLocationResults[0];
  }

  /**
   * Get statistics about audit results
   */
  async getStats() {
    const results = await this.loadResults();

    const stats = {
      totalAudits: results.length,
      uniqueUsers: new Set(results.map(r => r.userId)).size,
      uniqueLocations: new Set(results.map(r => r.locationId)).size,
      recentAudits: results.slice(0, 10),
      averageScore: 0
    };

    // Calculate average score
    const scoresWithValues = results.filter(r => r.score && r.score.overall);
    if (scoresWithValues.length > 0) {
      const totalScore = scoresWithValues.reduce((sum, r) => sum + r.score.overall, 0);
      stats.averageScore = Math.round(totalScore / scoresWithValues.length);
    }

    // Get activity by day (last 7 days)
    const last7Days = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days[dateStr] = 0;
    }

    results.forEach(result => {
      const dateStr = result.timestamp.split('T')[0];
      if (last7Days.hasOwnProperty(dateStr)) {
        last7Days[dateStr]++;
      }
    });

    stats.dailyActivity = Object.entries(last7Days).map(([date, count]) => ({
      date,
      count,
    }));

    return stats;
  }
}

export default new AuditResultsService();
