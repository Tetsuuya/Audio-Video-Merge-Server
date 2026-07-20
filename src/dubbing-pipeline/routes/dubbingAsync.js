const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createJob, getJob, updateJobStatus, updateJobStep, updateJobResult, saveJobTranscript } = require('../../shared/services/firebaseService');
const { processDubbingJob, processDubbingJobFromUrl } = require('../services/dubbingProcessor');
const log = require('../../shared/utils/logger');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/',
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'it', 'pt', 'ja', 'tl', 'hi'];

/**
 * Format step timeline array for frontend progress stepper
 */
function buildStepsArray(currentStep, jobStatus, currentLanguage = null) {
  const stepsList = [
    { id: 'extract_audio', label: 'Extract audio' },
    { id: 'transcribe', label: 'Transcribe' },
    { id: 'translate', label: 'Translate' },
    { id: 'tts_synthesis', label: 'TTS synthesis' },
    { id: 'merge_video', label: 'Merge video' }
  ];

  if (jobStatus === 'completed') {
    return stepsList.map(s => ({ ...s, status: 'completed' }));
  }

  if (jobStatus === 'failed') {
    let activeFailIdx = 0;
    if (currentStep === 'downloading' || currentStep === 'extracting_audio') activeFailIdx = 0;
    else if (currentStep === 'transcribing') activeFailIdx = 1;
    else if (currentStep === 'translating') activeFailIdx = 2;
    else if (currentStep === 'tts_synthesis') activeFailIdx = 3;
    else if (currentStep === 'merging') activeFailIdx = 4;

    return stepsList.map((s, idx) => {
      if (idx < activeFailIdx) return { ...s, status: 'completed' };
      if (idx === activeFailIdx) return { ...s, status: 'failed' };
      return { ...s, status: 'pending' };
    });
  }

  let activeIdx = 0;
  if (currentStep === 'downloading' || currentStep === 'extracting_audio') activeIdx = 0;
  else if (currentStep === 'transcribing') activeIdx = 1;
  else if (currentStep === 'translating') activeIdx = 2;
  else if (currentStep === 'tts_synthesis') activeIdx = 3;
  else if (currentStep === 'merging') activeIdx = 4;
  else if (currentStep === 'completed') activeIdx = 5;

  return stepsList.map((s, idx) => {
    if (idx < activeIdx) {
      return { ...s, status: 'completed' };
    } else if (idx === activeIdx) {
      return { 
        ...s, 
        status: 'in_progress',
        ...(currentLanguage ? { currentLanguage } : {})
      };
    } else {
      return { ...s, status: 'pending' };
    }
  });
}

/**
 * POST /api/dubbing/async/upload
 * Upload video and create async job
 */
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    // Normalize engine name — guard against casing issues from frontend (e.g. "Fish", "FISH")
    const rawEngine = req.body.ttsEngine || 'kokoro';
    const ttsEngine = rawEngine.toLowerCase().trim();
    const fishVoiceId = req.body.fishVoiceId || null;
    const { sourceLanguage } = req.body;
    const targetLanguages = JSON.parse(req.body.targetLanguages || '[]');
    const voices = typeof req.body.voices === 'string' ? JSON.parse(req.body.voices) : (req.body.voices || {});
    const videoFile = req.file;

    // 🔍 Debug: log exactly what the frontend sent so engine issues are visible
    log.info(`[Upload] raw body fields — ttsEngine=${JSON.stringify(rawEngine)}  fishVoiceId=${JSON.stringify(fishVoiceId)}  sourceLanguage=${JSON.stringify(sourceLanguage)}`);
    log.info(`[Upload] resolved engine → "${ttsEngine}"`);
    
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
    
    // Create job in Firestore (now also stores the engine used)
    await createJob(jobId, videoFile.originalname, sourceLanguage, targetLanguages, ttsEngine);
    
    log.job(jobId, `Created  ${sourceLanguage.toUpperCase()} → [${targetLanguages.map(l => l.toUpperCase()).join(', ')}]  engine=${ttsEngine}`);
    
    // Start background processing (don't await)
    processJobBackground(jobId, videoFile.path, sourceLanguage, targetLanguages, ttsEngine, fishVoiceId, voices).catch(err => {
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
    // Normalize engine name — guard against casing issues from frontend
    const rawEngine = req.body.ttsEngine || 'kokoro';
    const ttsEngine = rawEngine.toLowerCase().trim();
    const fishVoiceId = req.body.fishVoiceId || null;
    const { videoUrl, sourceLanguage, targetLanguages } = req.body;
    const voices = typeof req.body.voices === 'string' ? JSON.parse(req.body.voices) : (req.body.voices || {});

    // 🔍 Debug: log exactly what the frontend sent
    log.info(`[Single] raw body fields — ttsEngine=${JSON.stringify(rawEngine)}  fishVoiceId=${JSON.stringify(fishVoiceId)}  sourceLanguage=${JSON.stringify(sourceLanguage)}`);
    log.info(`[Single] resolved engine → "${ttsEngine}"`);
    
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
    
    // Create job in Firestore (now also stores the engine used)
    await createJob(jobId, videoUrl, sourceLanguage, languages, ttsEngine);
    
    log.job(jobId, `Created  ${sourceLanguage.toUpperCase()} → [${languages.map(l => l.toUpperCase()).join(', ')}]  engine=${ttsEngine}`);
    
    // Start background processing (don't await)
    processJobFromUrlBackground(jobId, videoUrl, sourceLanguage, languages, ttsEngine, fishVoiceId, voices).catch(err => {
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
 * Check job status with granular pipeline steps
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    const currentStep = job.currentStep || (job.status === 'completed' ? 'completed' : 'downloading');
    const currentLanguage = job.currentLanguage || null;

    const response = {
      success: true,
      jobId: job.jobId,
      status: job.status,
      currentStep: currentStep,
      currentLanguage: currentLanguage,
      sourceLanguage: job.sourceLanguage,
      targetLanguages: job.targetLanguages,
      ttsEngine: job.ttsEngine || 'kokoro',
      steps: buildStepsArray(currentStep, job.status, currentLanguage),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
    
    if (job.status === 'completed') {
      response.transcript = job.transcript || null;
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
async function processJobBackground(jobId, videoPath, sourceLanguage, targetLanguages, ttsEngine = 'kokoro', fishVoiceId = null, voices = {}) {
  try {
    log.job(jobId, 'Starting background processing');
    await updateJobStatus(jobId, 'processing');
    await updateJobStep(jobId, 'extracting_audio');

    const result = await processDubbingJob({
      jobId,
      videoPath,
      sourceLanguage,
      targetLanguages,
      ttsEngine,
      fishVoiceId,
      voices,
      onProgress: async (stage, language) => {
        log.job(jobId, `${stage}${language ? `  [${language}]` : ''}`);
        await updateJobStep(jobId, stage, language);
      }
    });

    for (const [language, langResult] of Object.entries(result.results)) {
      await updateJobResult(jobId, language, langResult);
    }

    // Save the global transcript (raw source transcription)
    if (result.transcript) {
      await saveJobTranscript(jobId, result.transcript);
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

    await updateJobStep(jobId, 'completed');
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
async function processJobFromUrlBackground(jobId, videoUrl, sourceLanguage, targetLanguages, ttsEngine = 'kokoro', fishVoiceId = null, voices = {}) {
  try {
    log.job(jobId, 'Starting background processing (URL)');
    await updateJobStatus(jobId, 'processing');
    await updateJobStep(jobId, 'downloading');

    const result = await processDubbingJobFromUrl({
      jobId,
      videoUrl,
      sourceLanguage,
      targetLanguages,
      ttsEngine,
      fishVoiceId,
      voices,
      onProgress: async (stage, language) => {
        log.job(jobId, `${stage}${language ? `  [${language}]` : ''}`);
        await updateJobStep(jobId, stage, language);
      }
    });

    for (const [language, langResult] of Object.entries(result.results)) {
      await updateJobResult(jobId, language, langResult);
    }

    // Save the global transcript (raw source transcription)
    if (result.transcript) {
      await saveJobTranscript(jobId, result.transcript);
    }

    if (result.metrics) {
      const { db } = require('../../shared/services/firebaseService');
      const { FieldValue } = require('firebase-admin/firestore');
      await db.collection('jobs').doc(jobId).update({
        metrics: result.metrics,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    await updateJobStep(jobId, 'completed');
    await updateJobStatus(jobId, 'completed');
    log.job(jobId, `Complete  ${result.metrics?.total_duration}s`);

  } catch (error) {
    log.error(`Job ${jobId} failed: ${error.message}`);
    await updateJobStatus(jobId, 'failed', error.message);
  }
}

module.exports = router;
