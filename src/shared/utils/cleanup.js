/**
 * CLEANUP UTILITY
 * 
 * Purpose: Remove old files from temp/ and public/output/ folders
 * 
 * Strategy:
 * - Delete files older than configured age
 * - Run automatically on schedule (optional)
 * - Can be triggered manually
 * 
 * Configuration via environment:
 * - CLEANUP_MAX_AGE_HOURS (default: 24)
 * - CLEANUP_INTERVAL_HOURS (default: 1)
 */

const fs = require('fs').promises;
const path = require('path');
const log = require('./logger');

// Configuration
const MAX_AGE_HOURS = parseInt(process.env.CLEANUP_MAX_AGE_HOURS || '24');
const CLEANUP_INTERVAL_HOURS = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '1');
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;

/**
 * Delete files older than MAX_AGE_HOURS from a directory
 * @param {string} dirPath - Directory to clean
 * @param {number} maxAgeMs - Max age in milliseconds
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function cleanDirectory(dirPath, maxAgeMs = MAX_AGE_MS) {
  let deleted = 0;
  let errors = 0;

  try {
    // Check if directory exists
    try {
      await fs.access(dirPath);
    } catch (err) {
      log.warn(`Directory doesn't exist, skipping: ${dirPath}`);
      return { deleted: 0, errors: 0 };
    }

    const files = await fs.readdir(dirPath);
    const now = Date.now();

    for (const file of files) {
      // Skip .gitkeep files
      if (file === '.gitkeep') continue;

      const filePath = path.join(dirPath, file);

      try {
        const stats = await fs.stat(filePath);

        // Skip directories
        if (stats.isDirectory()) continue;

        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAgeMs) {
          await fs.unlink(filePath);
          deleted++;
          log.info(`Deleted old file: ${file}  (age: ${(fileAge / 1000 / 60 / 60).toFixed(1)}h)`);
        }
      } catch (err) {
        log.error(`Failed to delete ${file}: ${err.message}`);
        errors++;
      }
    }
  } catch (err) {
    log.error(`Failed to clean directory ${dirPath}: ${err.message}`);
    errors++;
  }

  return { deleted, errors };
}

/**
 * Clean all temporary and output directories
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function cleanAll() {
  log.section(`Cleanup  |  max age: ${MAX_AGE_HOURS}h`);

  const tempDir = path.join(process.cwd(), 'temp');
  const outputDir = path.join(process.cwd(), 'public', 'output');

  const tempResults = await cleanDirectory(tempDir);
  const outputResults = await cleanDirectory(outputDir);

  const totalDeleted = tempResults.deleted + outputResults.deleted;
  const totalErrors = tempResults.errors + outputResults.errors;

  log.success(`Cleanup done  —  ${totalDeleted} deleted, ${totalErrors} errors`);

  return { deleted: totalDeleted, errors: totalErrors };
}

/**
 * Start automatic cleanup on interval
 * @param {number} intervalHours - Hours between cleanups
 */
function startAutoCleanup(intervalHours = CLEANUP_INTERVAL_HOURS) {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  log.info(`Auto-cleanup enabled  (every ${intervalHours}h, max age: ${MAX_AGE_HOURS}h)`);

  // Run immediately on start
  cleanAll();

  // Then run on interval
  setInterval(() => {
    cleanAll();
  }, intervalMs);
}

module.exports = {
  cleanAll,
  cleanDirectory,
  startAutoCleanup,
  MAX_AGE_HOURS,
  CLEANUP_INTERVAL_HOURS
};
