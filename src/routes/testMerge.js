/**
 * LOCAL TESTING ENDPOINTS
 * 
 * Purpose: Test merge functionality locally without auth or webhooks
 * 
 * Routes:
 * - POST /test/merge-one: Test merging single audio track with video
 * 
 * Auth: None (local testing only, not exposed in production)
 * 
 * These endpoints are used during development steps:
 * - Step 2: Single audio + video merge
 * - Step 3: Multiple audio tracks
 * - Step 4: Storage/download URLs
 * 
 * Request body for /test/merge-one:
 * {
 *   videoPath: string (local file path or URL),
 *   audioPath: string (local file path or URL),
 *   outputName: string (optional, filename for output)
 * }
 * 
 * Response:
 * {
 *   status: 'success',
 *   outputUrl: string (URL to download merged video),
 *   duration: number (processing time in ms)
 * }
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { mergeAudioVideo, getDuration } = require('../services/ffmpegService');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'temp'),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// POST /test/merge-one - Test single audio/video merge (accepts file paths via JSON)
router.post('/merge-one', async (req, res) => {
  const { videoPath, audioPath, outputName } = req.body;

  if (!videoPath || !audioPath) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: videoPath, audioPath'
    });
  }

  const startTime = Date.now();

  try {
    // Validate input files exist
    try {
      await fs.access(videoPath);
      await fs.access(audioPath);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: `Input file not found: ${error.message}`
      });
    }

    // Get durations for logging
    const videoDuration = await getDuration(videoPath);
    const audioDuration = await getDuration(audioPath);
    
    console.log(`Input durations - Video: ${videoDuration.toFixed(2)}s, Audio: ${audioDuration.toFixed(2)}s`);
    
    if (Math.abs(videoDuration - audioDuration) > 1.0) {
      console.warn(`⚠️  Duration mismatch: ${Math.abs(videoDuration - audioDuration).toFixed(2)}s difference`);
    }

    // Generate output path
    const timestamp = Date.now();
    const outputFileName = outputName || `merged_${timestamp}.mp4`;
    const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Merge video and audio
    console.log(`Starting merge: ${path.basename(videoPath)} + ${path.basename(audioPath)}`);
    await mergeAudioVideo(videoPath, audioPath, outputPath);

    // Verify output file was created
    const stats = await fs.stat(outputPath);
    const outputDuration = await getDuration(outputPath);

    const duration = Date.now() - startTime;

    // Generate download URL
    const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';
    const downloadUrl = `${serverUrl}/output/${outputFileName}`;

    console.log(`✓ Merge completed in ${duration}ms`);
    console.log(`  Output: ${outputFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${outputDuration.toFixed(2)}s)`);

    res.json({
      status: 'success',
      outputUrl: downloadUrl,
      outputPath: `/output/${outputFileName}`,
      outputFile: outputFileName,
      duration: duration,
      fileSize: stats.size,
      outputDuration: outputDuration,
      inputDurations: {
        video: videoDuration,
        audio: audioDuration
      },
      message: 'Audio and video merged successfully'
    });
  } catch (error) {
    console.error('Merge failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      duration: Date.now() - startTime
    });
  }
});

// POST /test/merge-one-upload - Test single audio/video merge (accepts file uploads via FormData)
router.post('/merge-one-upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.files || !req.files.video || !req.files.audio) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing video or audio file'
      });
    }

    const videoPath = req.files.video[0].path;
    const audioPath = req.files.audio[0].path;
    const outputName = req.body.outputName;

    // Get durations for logging
    const videoDuration = await getDuration(videoPath);
    const audioDuration = await getDuration(audioPath);
    
    console.log(`Input durations - Video: ${videoDuration.toFixed(2)}s, Audio: ${audioDuration.toFixed(2)}s`);
    
    if (Math.abs(videoDuration - audioDuration) > 1.0) {
      console.warn(`⚠️  Duration mismatch: ${Math.abs(videoDuration - audioDuration).toFixed(2)}s difference`);
    }

    // Generate output path
    const timestamp = Date.now();
    const outputFileName = outputName || `merged_${timestamp}.mp4`;
    const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Merge video and audio
    console.log(`Starting merge: ${req.files.video[0].originalname} + ${req.files.audio[0].originalname}`);
    await mergeAudioVideo(videoPath, audioPath, outputPath);

    // Clean up uploaded temp files
    await fs.unlink(videoPath).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});

    // Verify output file was created
    const stats = await fs.stat(outputPath);
    const outputDuration = await getDuration(outputPath);

    const duration = Date.now() - startTime;

    // Generate download URL
    const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';
    const downloadUrl = `${serverUrl}/output/${outputFileName}`;

    console.log(`✓ Merge completed in ${duration}ms`);
    console.log(`  Output: ${outputFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${outputDuration.toFixed(2)}s)`);

    res.json({
      status: 'success',
      outputUrl: downloadUrl,
      outputPath: `/output/${outputFileName}`,
      outputFile: outputFileName,
      duration: duration,
      fileSize: stats.size,
      outputDuration: outputDuration,
      inputDurations: {
        video: videoDuration,
        audio: audioDuration
      },
      message: 'Audio and video merged successfully'
    });
  } catch (error) {
    console.error('Merge failed:', error);
    
    // Clean up temp files on error
    if (req.files) {
      if (req.files.video) await fs.unlink(req.files.video[0].path).catch(() => {});
      if (req.files.audio) await fs.unlink(req.files.audio[0].path).catch(() => {});
    }
    
    res.status(500).json({
      status: 'error',
      message: error.message,
      duration: Date.now() - startTime
    });
  }
});

// POST /test/merge-multiple - Test multiple audio tracks
router.post('/merge-multiple', async (req, res) => {
  const { videoPath, audioTracks } = req.body;

  if (!videoPath || !audioTracks || !Array.isArray(audioTracks)) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing or invalid fields: videoPath, audioTracks (array)'
    });
  }

  try {
    // TODO: Implement multiple track merge
    // Loop through audioTracks and merge each one
    
    res.json({
      status: 'success',
      message: 'Multiple merge test not yet implemented',
      tracksToProcess: audioTracks.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
