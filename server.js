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

// Import logger and cleanup utility
const log = require('./src/shared/utils/logger');
const { startAutoCleanup } = require('./src/shared/utils/cleanup');

// Configuration
const PORT = process.env.PORT || 8080;
const AUTO_CLEANUP = process.env.AUTO_CLEANUP !== 'false'; // Default: enabled

// Middleware
app.use(express.json());

// CORS Configuration - Supports ALLOWED_ORIGINS env variable and allows x-dubbing-secret header
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-dubbing-secret']
}));

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
const dubbingAsyncRoute = require('./src/dubbing-pipeline/routes/dubbingAsync');

// Async-only routes
app.use('/api/dubbing/async', dubbingAsyncRoute);

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
  log.section(`Dubbing Server  —  port ${PORT}`);
  log.info(`Merge-Only API`);
  log.detail(`GET  /health`);
  log.detail(`POST /test/merge-one`);
  log.detail(`POST /test/merge-multiple`);
  log.detail(`POST /merge  (production)`);
  log.info(`Full Dubbing Pipeline API`);
  log.detail(`POST /api/dubbing/async/single`);
  log.detail(`POST /api/dubbing/async/upload`);
  log.detail(`GET  /api/dubbing/async/status/:jobId`);
  log.info(`Test interfaces`);
  log.detail(`http://localhost:${PORT}/dubbing.html`);
  log.detail(`http://localhost:${PORT}/merge.html`);
  log.info(`Gemini AI Text Reduction: ${process.env.GEMINI_API_KEY ? 'ENABLED (' + (process.env.GEMINI_MODEL || 'gemini-flash-lite-latest') + ')' : 'DISABLED (No API Key)'}`);

  if (AUTO_CLEANUP) {
    startAutoCleanup();
  } else {
    log.warn('Auto-cleanup disabled. Run "npm run cleanup" manually.');
  }
});
