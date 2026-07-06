/**
 * MAIN SERVER ENTRY POINT
 * 
 * Purpose: Standalone audio/video merge server for the dubbing pipeline
 * 
 * This server receives video + audio tracks from the Next.js app, merges them
 * using ffmpeg, stores the results, and reports back via webhook.
 * 
 * Core responsibilities:
 * - Accept POST /merge requests (main production endpoint)
 * - Accept POST /test/merge-one for local testing (single track)
 * - Provide /health endpoint for monitoring
 * - Authenticate requests via x-dubbing-secret header
 * - Process jobs asynchronously (respond 202 Accepted immediately)
 * - Call webhook with results when processing completes
 * 
 * Flow:
 * 1. Next.js app sends POST /merge with video + audio tracks
 * 2. Server responds 202 Accepted with jobId
 * 3. Server downloads video and audio files
 * 4. For each audio track: merge with ffmpeg, save output
 * 5. Server calls webhook with download URLs
 * 
 * Deployment: Railway (production) / localhost:8080 (development)
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Load environment variables
require('dotenv').config();

// Configuration
const PORT = process.env.PORT || 8080;
const DUBBING_SECRET = process.env.CUSTOM_DUBBING_SECRET;

// Middleware
app.use(express.json());
app.use(cors());

// Serve static test page
app.use(express.static('public'));

// Import routes
const healthRoute = require('./src/routes/health');
const mergeRoute = require('./src/routes/merge');
const testMergeRoute = require('./src/routes/testMerge');

// Route handlers
app.use('/health', healthRoute);
app.use('/merge', mergeRoute);
app.use('/test', testMergeRoute);

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
  console.log(`Dubbing merge server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
