const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createJob, getJob, updateJobStatus, updateJobResult } = require('../../shared/services/firebaseService');
const { processDubbingJob, processDubbingJobFromUrl } = require('../services/dubbingProcessor');
const log = require('../../shared/utils/logger');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/',
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'it', 'pt', 'hi'];

/**
 * POST /api/dubbing/async/upload
 * Upload video and create async job
 */
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const { sourceLanguage } = req.body;
    const targetLanguages = JSON.parse(req.body.targetLanguages || '[]');
    const videoFile = req.file;
    
    if (!videoFile) {
      return res.status(400).json({ success: false, error: 'No video file uploaded' });
    }
    
    if (!sourceLanguage || targetLanguages.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Validate languages
    const unsupportedLangs = targetLanguages.filter(lang => !SUPPORTED_LANGUAGES.includes(lang));
    if (unsupportedLangs.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Unsupported languages: ${unsupportedLangs.join(', ')}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` 
      });
    }
    
    const jobId = 'job_' + Date.now();
    
    // Create job in Firestore
    await createJob(jobId, videoFile.originalname, sourceLanguage, targetLanguages);
    
    log.job(jobId, `Created  ${sourceLanguage.toUpperCase()} → [${targetLanguages.map(l => l.toUpperCase()).join(', ')}]`);
    
    // Start background processing (don't await)
    processJobBackground(jobId, videoFile.path, sourceLanguage, targetLanguages).catch(err => {
      log.error(`Job ${jobId} failed: ${err.message}`);
      updateJobStatus(jobId, 'failed', err.message);
    });
    
    // Return immediately with jobId
    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Job queued for processing',
      statusUrl: `/api/dubbing/async/status/${jobId}`,
      estimatedTime: `${targetLanguages.length * 30}-${targetLanguages.length * 60}s`
    });
    
  } catch (error) {
    log.error(`Failed to create job (upload): ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/dubbing/async/single
 * Create async job from video URL
 */
router.post('/single', async (req, res) => {
  try {
    const { videoUrl, sourceLanguage, targetLanguages } = req.body;
    
    // Support both single targetLanguage and multiple targetLanguages
    let languages = [];
    if (targetLanguages && Array.isArray(targetLanguages)) {
      languages = targetLanguages;
    } else if (req.body.targetLanguage) {
      languages = [req.body.targetLanguage];
    } else {
      return res.status(400).json({ success: false, error: 'Missing targetLanguage or targetLanguages' });
    }
    
    if (!videoUrl || !sourceLanguage || languages.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Validate languages
    const unsupportedLangs = languages.filter(lang => !SUPPORTED_LANGUAGES.includes(lang));
    if (unsupportedLangs.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Unsupported languages: ${unsupportedLangs.join(', ')}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` 
      });
    }
    
    const jobId = 'job_' + Date.now();
    
    // Create job in Firestore
    await createJob(jobId, videoUrl, sourceLanguage, languages);
    
    log.job(jobId, `Created  ${sourceLanguage.toUpperCase()} → [${languages.map(l => l.toUpperCase()).join(', ')}]`);
    
    // Start background processing (don't await)
    processJobFromUrlBackground(jobId, videoUrl, sourceLanguage, languages).catch(err => {
      log.error(`Job ${jobId} failed: ${err.message}`);
      updateJobStatus(jobId, 'failed', err.message);
    });
    
    // Return immediately with jobId
    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Job queued for processing',
      statusUrl: `/api/dubbing/async/status/${jobId}`,
      estimatedTime: `${languages.length * 30}-${languages.length * 60}s`
    });
    
  } catch (error) {
    log.error(`Failed to create job (single): ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dubbing/async/status/:jobId
 * Check job status
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    const response = {
      success: true,
      jobId: job.jobId,
      status: job.status,
      sourceLanguage: job.sourceLanguage,
      targetLanguages: job.targetLanguages,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
    
    if (job.status === 'completed') {
      response.results = job.results;
      response.metrics = job.metrics || null;
      response.completedAt = job.completedAt;
    }
    
    if (job.status === 'failed') {
      response.error = job.error;
    }
    
    res.json(response);
    
  } catch (error) {
    log.error(`Failed to get job status: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Background processing function
 */
async function processJobBackground(jobId, videoPath, sourceLanguage, targetLanguages) {
  try {
    log.job(jobId, 'Starting background processing');
    await updateJobStatus(jobId, 'processing');

    const result = await processDubbingJob({
      jobId,
      videoPath,
      sourceLanguage,
      targetLanguages,
      onProgress: async (stage, language) => {
        log.job(jobId, `${stage}${language ? `  [${language}]` : ''}`);
      }
    });

    for (const [language, langResult] of Object.entries(result.results)) {
      await updateJobResult(jobId, language, langResult);
    }

    if (result.metrics) {
      const { db } = require('../../shared/services/firebaseService');
      const { FieldValue } = require('firebase-admin/firestore');
      await db.collection('jobs').doc(jobId).update({
        metrics: result.metrics,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    try {
      fs.unlinkSync(videoPath);
    } catch (err) {
      log.warn(`Failed to delete uploaded file: ${err.message}`);
    }

    await updateJobStatus(jobId, 'completed');
    log.job(jobId, `Complete  ${result.metrics?.total_duration}s`);

  } catch (error) {
    log.error(`Job ${jobId} failed: ${error.message}`);
    await updateJobStatus(jobId, 'failed', error.message);
  }
}

/**
 * Background processing function for URL-based videos
 */
async function processJobFromUrlBackground(jobId, videoUrl, sourceLanguage, targetLanguages) {
  try {
    log.job(jobId, 'Starting background processing (URL)');
    await updateJobStatus(jobId, 'processing');

    const result = await processDubbingJobFromUrl({
      jobId,
      videoUrl,
      sourceLanguage,
      targetLanguages,
      onProgress: async (stage, language) => {
        log.job(jobId, `${stage}${language ? `  [${language}]` : ''}`);
      }
    });

    for (const [language, langResult] of Object.entries(result.results)) {
      await updateJobResult(jobId, language, langResult);
    }

    if (result.metrics) {
      const { db } = require('../../shared/services/firebaseService');
      const { FieldValue } = require('firebase-admin/firestore');
      await db.collection('jobs').doc(jobId).update({
        metrics: result.metrics,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    await updateJobStatus(jobId, 'completed');
    log.job(jobId, `Complete  ${result.metrics?.total_duration}s`);

  } catch (error) {
    log.error(`Job ${jobId} failed: ${error.message}`);
    await updateJobStatus(jobId, 'failed', error.message);
  }
}

module.exports = router;
