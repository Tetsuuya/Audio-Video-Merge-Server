/**
 * PRODUCTION MERGE ENDPOINT
 * 
 * Purpose: Main endpoint that receives merge jobs from Next.js app
 * 
 * Route: POST /merge
 * Auth: Required - x-dubbing-secret header must match CUSTOM_DUBBING_SECRET
 * 
 * Request body:
 * {
 *   jobId: string,
 *   projectId: string,
 *   videoUrl: string (URL to video file),
 *   audioTracks: [
 *     { language: string, audioUrl: string },
 *     ...
 *   ],
 *   webhookUrl: string (callback URL for results)
 * }
 * 
 * Response: 202 Accepted (immediate response, processing happens async)
 * {
 *   jobId: string,
 *   status: 'processing',
 *   message: 'Job accepted'
 * }
 * 
 * Processing flow:
 * 1. Validate request & auth
 * 2. Respond 202 immediately
 * 3. Download video from videoUrl
 * 4. For each audioTrack:
 *    - Download audio from audioUrl
 *    - Merge with video using ffmpeg
 *    - Save output to storage
 *    - Generate download URL
 * 5. Call webhookUrl with results
 * 
 * Webhook payload (success):
 * {
 *   jobId: string,
 *   projectId: string,
 *   status: 'completed',
 *   results: {
 *     'fr-FR': 'https://storage.com/video-fr.mp4',
 *     'de-DE': 'https://storage.com/video-de.mp4'
 *   }
 * }
 * 
 * Webhook payload (failure):
 * {
 *   jobId: string,
 *   projectId: string,
 *   status: 'failed',
 *   error: string
 * }
 * 
 * Webhook payload (partial failure):
 * {
 *   jobId: string,
 *   projectId: string,
 *   status: 'partial',
 *   results: {
 *     'fr-FR': 'https://storage.com/video-fr.mp4',
 *     'de-DE': { error: 'ffmpeg merge failed: unsupported codec' }
 *   }
 * }
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  const { jobId, projectId, videoUrl, audioTracks, webhookUrl } = req.body;

  // Validate required fields
  if (!jobId || !projectId || !videoUrl || !audioTracks || !webhookUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: jobId, projectId, videoUrl, audioTracks, webhookUrl'
    });
  }

  if (!Array.isArray(audioTracks) || audioTracks.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'audioTracks must be a non-empty array'
    });
  }

  // Respond immediately (202 Accepted)
  res.status(202).json({
    jobId,
    status: 'processing',
    message: 'Job accepted and processing started'
  });

  // TODO: Process job asynchronously
  // 1. Download video from videoUrl
  // 2. For each audioTrack, download audio and merge
  // 3. Store results and call webhook
  
  console.log(`Job ${jobId} accepted for processing`);
  console.log(`Video: ${videoUrl}`);
  console.log(`Audio tracks: ${audioTracks.length}`);
  console.log(`Webhook: ${webhookUrl}`);
});

module.exports = router;
