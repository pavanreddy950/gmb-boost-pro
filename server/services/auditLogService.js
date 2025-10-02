import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIT_LOG_FILE = path.join(__dirname, '../data/auditLogs.json');

class AuditLogService {
  constructor() {
    this.initializeLogFile();
  }

  async initializeLogFile() {
    try {
      await fs.access(AUDIT_LOG_FILE);
    } catch {
      // File doesn't exist, create it
      const dataDir = path.dirname(AUDIT_LOG_FILE);
      try {
        await fs.access(dataDir);
      } catch {
        await fs.mkdir(dataDir, { recursive: true });
      }
      await fs.writeFile(AUDIT_LOG_FILE, JSON.stringify([], null, 2));
    }
  }

  async loadLogs() {
    try {
      const data = await fs.readFile(AUDIT_LOG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      return [];
    }
  }

  async saveLogs(logs) {
    try {
      await fs.writeFile(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Error saving audit logs:', error);
    }
  }

  /**
   * Log an admin action
   * @param {Object} logEntry - The log entry to record
   * @param {string} logEntry.action - Action type (user.update, user.delete, coupon.create, etc.)
   * @param {string} logEntry.adminId - ID of the admin performing the action
   * @param {string} logEntry.adminEmail - Email of the admin
   * @param {string} logEntry.description - Human-readable description
   * @param {Object} logEntry.metadata - Additional metadata
   * @param {string} logEntry.targetType - Type of entity affected (user, coupon, subscription, etc.)
   * @param {string} logEntry.targetId - ID of the affected entity
   */
  async log(logEntry) {
    const logs = await this.loadLogs();

    const newLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action: logEntry.action,
      adminId: logEntry.adminId,
      adminEmail: logEntry.adminEmail,
      description: logEntry.description,
      targetType: logEntry.targetType,
      targetId: logEntry.targetId,
      metadata: logEntry.metadata || {},
      ipAddress: logEntry.ipAddress || null,
    };

    logs.unshift(newLog); // Add to beginning for reverse chronological order

    // Keep only last 1000 logs to prevent file from growing too large
    if (logs.length > 1000) {
      logs.splice(1000);
    }

    await this.saveLogs(logs);
    return newLog;
  }

  /**
   * Get audit logs with optional filtering
   * @param {Object} options - Filter options
   * @param {number} options.limit - Maximum number of logs to return
   * @param {number} options.offset - Number of logs to skip
   * @param {string} options.action - Filter by action type
   * @param {string} options.adminId - Filter by admin ID
   * @param {string} options.targetType - Filter by target type
   * @param {string} options.startDate - Filter by start date (ISO string)
   * @param {string} options.endDate - Filter by end date (ISO string)
   */
  async getLogs(options = {}) {
    const logs = await this.loadLogs();
    let filteredLogs = [...logs];

    // Apply filters
    if (options.action) {
      filteredLogs = filteredLogs.filter(log => log.action === options.action);
    }

    if (options.adminId) {
      filteredLogs = filteredLogs.filter(log => log.adminId === options.adminId);
    }

    if (options.targetType) {
      filteredLogs = filteredLogs.filter(log => log.targetType === options.targetType);
    }

    if (options.startDate) {
      const startDate = new Date(options.startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= startDate);
    }

    if (options.endDate) {
      const endDate = new Date(options.endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= endDate);
    }

    // Apply pagination
    const offset = parseInt(options.offset) || 0;
    const limit = parseInt(options.limit) || 50;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      offset,
      limit,
    };
  }

  /**
   * Get statistics about audit logs
   */
  async getStats() {
    const logs = await this.loadLogs();

    const stats = {
      totalLogs: logs.length,
      actionBreakdown: {},
      targetTypeBreakdown: {},
      recentActivity: logs.slice(0, 10),
    };

    // Count by action type
    logs.forEach(log => {
      stats.actionBreakdown[log.action] = (stats.actionBreakdown[log.action] || 0) + 1;
      stats.targetTypeBreakdown[log.targetType] = (stats.targetTypeBreakdown[log.targetType] || 0) + 1;
    });

    // Get activity by day (last 7 days)
    const last7Days = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days[dateStr] = 0;
    }

    logs.forEach(log => {
      const dateStr = log.timestamp.split('T')[0];
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

export default new AuditLogService();
