/**
 * HEALTH CHECK ENDPOINT
 * 
 * Purpose: Simple endpoint to verify server is running
 * 
 * Route: GET /health
 * Auth: None (public endpoint for monitoring)
 * 
 * Returns: 200 OK with server status
 * 
 * Used by:
 * - Railway health checks
 * - Local development verification (Step 0)
 * - Monitoring systems
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dubbing-merge-server',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
