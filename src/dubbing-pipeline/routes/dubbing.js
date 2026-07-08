const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { extractAudio } = require('../services/audioExtractionService');
const { transcribeAudio } = require('../services/transcriptionService');
const { translateText } = require('../services/translationService');
const { generateSpeech } = require('../services/ttsService');
const { mergeAudioVideo } = require('../../merge-only/services/ffmpegService');
const { downloadVideo } = require('../../merge-only/services/downloadService');
const { uploadVideo } = require('../../shared/services/cloudinaryService');

// Supported languages for Kokoro TTS
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'it', 'pt', 'hi', 'ja', 'zh'];

router.post('/single', async (req, res) => {
  const startTime = Date.now();
  const logTime = (step) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${elapsed}s] ${step}`);
  };
  
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
    
    console.log('\nStarting dubbing job:', videoUrl);
    console.log(`   ${sourceLanguage.toUpperCase()} -> [${languages.map(l => l.toUpperCase()).join(', ')}]`);
    logTime('Job received');
    
    const jobId = 'job_' + Date.now();
    let videoPath;
    
    if (videoUrl.startsWith('http')) {
      logTime('Downloading video...');
      videoPath = await downloadVideo(videoUrl, jobId);
      logTime('Download complete');
    } else {
      videoPath = videoUrl.replace(/\\/g, '/');
      if (!fs.existsSync(videoPath)) throw new Error('File not found: ' + videoPath);
      logTime('Using local video file');
    }
    
    logTime('Extracting audio...');
    const audioPath = await extractAudio(videoPath);
    logTime('Audio extracted');
    
    logTime('Transcribing audio...');
    const transcript = await transcribeAudio(audioPath, sourceLanguage);
    logTime(`Transcription complete (${transcript.text.length} chars)`);
    
    // Process each target language
    const results = {};
    
    for (const targetLang of languages) {
      const langStartTime = Date.now();
      console.log(`\n  Processing ${targetLang.toUpperCase()}...`);
      
      try {
        logTime(`  [${targetLang}] Translating...`);
        const translation = await translateText(transcript.text, sourceLanguage, targetLang);
        logTime(`  [${targetLang}] Translation complete`);
        
        logTime(`  [${targetLang}] Generating speech...`);
        const dubbedAudioPath = await generateSpeech(translation, targetLang);
        logTime(`  [${targetLang}] TTS complete`);
        
        logTime(`  [${targetLang}] Merging...`);
        const outputFileName = `dubbed_${sourceLanguage}_to_${targetLang}_${Date.now()}.mp4`;
        const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);
        await mergeAudioVideo(videoPath, dubbedAudioPath, outputPath);
        
        logTime(`  [${targetLang}] Uploading to Cloudinary...`);
        const cloudinaryUrl = await uploadVideo(outputPath, `${jobId}_${targetLang}`);
        
        const langTime = ((Date.now() - langStartTime) / 1000).toFixed(2);
        logTime(`  [${targetLang}] Complete in ${langTime}s`);
        
        results[targetLang] = {
          success: true,
          transcript: transcript.text,
          translation,
          video: cloudinaryUrl,
          processingTime: langTime + 's'
        };
        
      } catch (error) {
        const langTime = ((Date.now() - langStartTime) / 1000).toFixed(2);
        console.error(`  [${targetLang}] Failed after ${langTime}s:`, error.message);
        results[targetLang] = {
          success: false,
          error: error.message
        };
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`\nJob complete in ${totalTime}s`);
    console.log(`   Success: ${successCount}/${languages.length}\n`);
    
    res.json({ 
      success: true, 
      jobId, 
      sourceLanguage,
      original: {
        video: videoUrl,
        transcript: transcript.text
      },
      languages: results,
      totalProcessingTime: totalTime + 's'
    });
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\nDubbing failed after ${totalTime}s:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/multiple', async (req, res) => {
  const startTime = Date.now();
  const logTime = (step) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${elapsed}s] ${step}`);
  };
  
  try {
    const { videos } = req.body;
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or invalid videos array' });
    }
    
    console.log(`\nStarting batch dubbing: ${videos.length} videos`);
    logTime('Batch job received');
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoStartTime = Date.now();
      console.log(`\n========================================`);
      console.log(`Video ${i + 1}/${videos.length}: ${video.videoUrl}`);
      console.log(`   ${video.sourceLanguage.toUpperCase()} -> ${video.targetLanguage.toUpperCase()}`);
      
      try {
        const { videoUrl, sourceLanguage, targetLanguage } = video;
        if (!videoUrl || !sourceLanguage || !targetLanguage) {
          throw new Error('Missing required fields');
        }
        
        const jobId = 'job_' + Date.now() + '_' + i;
        let videoPath;
        
        if (videoUrl.startsWith('http')) {
          logTime(`  Downloading video ${i + 1}...`);
          videoPath = await downloadVideo(videoUrl, jobId);
          logTime(`  Download complete`);
        } else {
          videoPath = videoUrl.replace(/\\/g, '/');
          if (!fs.existsSync(videoPath)) throw new Error('File not found: ' + videoPath);
          logTime(`  Using local file`);
        }
        
        logTime(`  Extracting audio...`);
        const audioPath = await extractAudio(videoPath);
        
        logTime(`  Transcribing...`);
        const transcript = await transcribeAudio(audioPath, sourceLanguage);
        
        logTime(`  Translating...`);
        const translation = await translateText(transcript.text, sourceLanguage, targetLanguage);
        
        logTime(`  Generating speech...`);
        const dubbedAudioPath = await generateSpeech(translation, targetLanguage);
        
        logTime(`  Merging...`);
        const outputFileName = 'dubbed_' + sourceLanguage + '_to_' + targetLanguage + '_' + Date.now() + '.mp4';
        const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);
        await mergeAudioVideo(videoPath, dubbedAudioPath, outputPath);
        
        const downloadUrl = (process.env.SERVER_URL || 'http://localhost:8080') + '/output/' + outputFileName;
        const videoTime = ((Date.now() - videoStartTime) / 1000).toFixed(2);
        logTime(`  Video ${i + 1} complete in ${videoTime}s`);
        
        results.push({
          success: true,
          videoUrl,
          sourceLanguage,
          targetLanguage,
          downloadUrl,
          processingTime: videoTime + 's'
        });
        successCount++;
        
      } catch (error) {
        const videoTime = ((Date.now() - videoStartTime) / 1000).toFixed(2);
        console.error(`  Video ${i + 1} failed after ${videoTime}s:`, error.message);
        results.push({
          success: false,
          videoUrl: video.videoUrl,
          error: error.message
        });
        failCount++;
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n========================================`);
    console.log(`Batch complete in ${totalTime}s`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}\n`);
    
    res.json({
      success: true,
      totalVideos: videos.length,
      successCount,
      failCount,
      results,
      totalProcessingTime: totalTime + 's'
    });
    
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\nBatch dubbing failed after ${totalTime}s:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
