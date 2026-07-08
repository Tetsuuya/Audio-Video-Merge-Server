/**
 * MAIN SERVER ENTRY POINT
 * 
 * This server provides two separate APIs:
 * 1. Merge-Only API: Merge pre-existing audio with video
 * 2. Full Dubbing Pipeline: Extract → Transcribe → Translate → TTS → Merge
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Load environment variables
require('dotenv').config();

// Import cleanup utility
const { startAutoCleanup } = require('./src/shared/utils/cleanup');

// Configuration
const PORT = process.env.PORT || 8080;
const AUTO_CLEANUP = process.env.AUTO_CLEANUP !== 'false'; // Default: enabled

// Middleware
app.use(express.json());
app.use(cors());

// Serve static test page
app.use(express.static('public'));

// ===== MERGE-ONLY API ROUTES =====
const healthRoute = require('./src/merge-only/routes/health');
const mergeRoute = require('./src/merge-only/routes/merge');
const testMergeRoute = require('./src/merge-only/routes/testMerge');

app.use('/health', healthRoute);
app.use('/merge', mergeRoute);
app.use('/test', testMergeRoute);

// ===== DUBBING PIPELINE API ROUTES =====
const dubbingRoute = require('./src/dubbing-pipeline/routes/dubbing');
app.use('/api/dubbing', dubbingRoute);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Dubbing Server running on port ${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Merge-Only API:`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/test/merge-one`);
  console.log(`   POST http://localhost:${PORT}/test/merge-multiple`);
  console.log(`   POST http://localhost:${PORT}/merge (production)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎬 Full Dubbing Pipeline API:`);
  console.log(`   POST http://localhost:${PORT}/api/dubbing/single`);
  console.log(`   POST http://localhost:${PORT}/api/dubbing/multiple`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌐 Test Interface: http://localhost:${PORT}/test.html`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // Start automatic cleanup if enabled
  if (AUTO_CLEANUP) {
    startAutoCleanup();
  } else {
    console.log('⚠️  Auto-cleanup disabled. Run "npm run cleanup" manually.');
  }
});
