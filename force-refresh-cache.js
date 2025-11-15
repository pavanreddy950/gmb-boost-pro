/**
 * Force Refresh Cache Script
 *
 * Run this in the browser console to clear all GBP caches and force a fresh data load.
 *
 * Instructions:
 * 1. Open browser console (F12 or Ctrl+Shift+I)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 * 4. The page will reload with fresh data
 */

console.log('🧹 Clearing all GBP caches...');

// Clear localStorage cache
localStorage.removeItem('gbp_cache');
console.log('✅ Cleared localStorage cache');

// Clear sessionStorage
sessionStorage.clear();
console.log('✅ Cleared sessionStorage');

// Clear all cookies (optional)
document.cookie.split(";").forEach(function(c) {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
console.log('✅ Cleared cookies');

console.log('🔄 Reloading page to fetch fresh data...');

// Reload the page
setTimeout(() => {
  window.location.reload();
}, 500);
