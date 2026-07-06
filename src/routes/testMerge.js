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

// POST /test/merge-multiple - Test multiple audio tracks with file paths
router.post('/merge-multiple', async (req, res) => {
  const { videoPath, audioTracks } = req.body;

  if (!videoPath || !audioTracks || !Array.isArray(audioTracks)) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing or invalid fields: videoPath, audioTracks (array of {language, audioPath})'
    });
  }

  const startTime = Date.now();
  const results = [];
  const errors = [];

  try {
    // Validate video file exists
    await fs.access(videoPath);
    const videoDuration = await getDuration(videoPath);

    console.log(`\n🎬 Processing ${audioTracks.length} audio tracks for video: ${path.basename(videoPath)}`);
    console.log(`Video duration: ${videoDuration.toFixed(2)}s\n`);

    // Process each audio track
    for (let i = 0; i < audioTracks.length; i++) {
      const track = audioTracks[i];
      const { language, audioPath } = track;

      if (!language || !audioPath) {
        errors.push({
          track: i + 1,
          language: language || 'unknown',
          error: 'Missing language or audioPath'
        });
        continue;
      }

      try {
        // Validate audio file
        await fs.access(audioPath);
        const audioDuration = await getDuration(audioPath);

        console.log(`[${i + 1}/${audioTracks.length}] ${language}: ${path.basename(audioPath)} (${audioDuration.toFixed(2)}s)`);

        // Generate output filename
        const timestamp = Date.now();
        const outputFileName = `merged_${language}_${timestamp}.mp4`;
        const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);

        // Merge
        await mergeAudioVideo(videoPath, audioPath, outputPath);

        // Get output info
        const stats = await fs.stat(outputPath);
        const outputDuration = await getDuration(outputPath);
        const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';

        results.push({
          language,
          status: 'success',
          outputUrl: `${serverUrl}/output/${outputFileName}`,
          outputFile: outputFileName,
          fileSize: stats.size,
          duration: outputDuration,
          inputDuration: audioDuration
        });

        console.log(`  ✓ Success: ${outputFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      } catch (error) {
        console.error(`  ✗ Failed: ${error.message}`);
        errors.push({
          track: i + 1,
          language,
          error: error.message
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    console.log(`\n✓ Batch complete: ${results.length} successful, ${errors.length} failed (${totalDuration}ms)\n`);

    res.json({
      status: errors.length === 0 ? 'success' : 'partial',
      processed: audioTracks.length,
      successful: results.length,
      failed: errors.length,
      duration: totalDuration,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Batch merge failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      duration: Date.now() - startTime
    });
  }
});

// POST /test/merge-multiple-upload - Test multiple audio tracks with file uploads
router.post('/merge-multiple-upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audios', maxCount: 50 } // Support up to 50 audio tracks
]), async (req, res) => {
  const startTime = Date.now();
  const results = [];
  const errors = [];
  const tempFiles = [];

  try {
    if (!req.files || !req.files.video || !req.files.audios) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing video or audio files'
      });
    }

    const videoPath = req.files.video[0].path;
    tempFiles.push(videoPath);
    
    const audioFiles = req.files.audios;
    const languages = JSON.parse(req.body.languages || '[]');

    if (languages.length !== audioFiles.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Languages array length must match number of audio files'
      });
    }

    const videoDuration = await getDuration(videoPath);
    console.log(`\n🎬 Processing ${audioFiles.length} audio tracks`);
    console.log(`Video duration: ${videoDuration.toFixed(2)}s\n`);

    // Process each audio file
    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i];
      const language = languages[i];
      const audioPath = audioFile.path;
      tempFiles.push(audioPath);

      try {
        const audioDuration = await getDuration(audioPath);
        console.log(`[${i + 1}/${audioFiles.length}] ${language}: ${audioFile.originalname} (${audioDuration.toFixed(2)}s)`);

        // Generate output
        const timestamp = Date.now();
        const outputFileName = `merged_${language}_${timestamp}_${i}.mp4`;
        const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);

        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Merge
        await mergeAudioVideo(videoPath, audioPath, outputPath);

        // Get output info
        const stats = await fs.stat(outputPath);
        const outputDuration = await getDuration(outputPath);
        const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';

        results.push({
          language,
          status: 'success',
          outputUrl: `${serverUrl}/output/${outputFileName}`,
          outputFile: outputFileName,
          fileSize: stats.size,
          duration: outputDuration,
          inputDuration: audioDuration
        });

        console.log(`  ✓ Success: ${outputFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      } catch (error) {
        console.error(`  ✗ Failed: ${error.message}`);
        errors.push({
          track: i + 1,
          language,
          error: error.message
        });
      }
    }

    // Clean up temp files
    for (const file of tempFiles) {
      await fs.unlink(file).catch(() => {});
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n✓ Batch complete: ${results.length} successful, ${errors.length} failed (${totalDuration}ms)\n`);

    res.json({
      status: errors.length === 0 ? 'success' : 'partial',
      processed: audioFiles.length,
      successful: results.length,
      failed: errors.length,
      duration: totalDuration,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Batch merge failed:', error);
    
    // Clean up temp files on error
    for (const file of tempFiles) {
      await fs.unlink(file).catch(() => {});
    }

    res.status(500).json({
      status: 'error',
      message: error.message,
      duration: Date.now() - startTime
    });
  }
});

module.exports = router;
