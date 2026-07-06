/**
 * Manual cleanup script
 * 
 * Usage: node scripts/cleanup.js
 * 
 * Deletes old files from temp/ and public/output/ folders
 */

require('dotenv').config();
const { cleanAll } = require('../src/utils/cleanup');

async function runCleanup() {
  console.log('Running manual cleanup...\n');
  
  try {
    const result = await cleanAll();
    
    if (result.deleted === 0 && result.errors === 0) {
      console.log('✓ No old files to clean up.');
    } else if (result.errors > 0) {
      console.log(`⚠️  Cleanup completed with errors.`);
      process.exit(1);
    } else {
      console.log(`✓ Successfully cleaned up ${result.deleted} file(s).`);
    }
  } catch (err) {
    console.error('✗ Cleanup failed:', err);
    process.exit(1);
  }
}

runCleanup();
