/**
 * Logger Utility
 * Only logs in development mode, silent in production
 */

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },

  info: (...args) => {
    if (isDev) console.info(...args);
  },

  warn: (...args) => {
    // Warnings are shown in both dev and production
    console.warn(...args);
  },

  error: (...args) => {
    // Errors are always shown
    console.error(...args);
  },

  debug: (...args) => {
    if (isDev) console.debug(...args);
  },

  // For critical logs that should always show (like server startup)
  always: (...args) => {
    console.log(...args);
  }
};

export default logger;
