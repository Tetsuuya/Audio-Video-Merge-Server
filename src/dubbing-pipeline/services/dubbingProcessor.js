/**
 * DUBBING PROCESSOR SERVICE
 * 
 * Shared processing logic for both sync and async dubbing
 */

const path = require('path');
const fs = require('fs');
const { extractAudio } = require('./audioExtractionService');
const { transcribeAudio } = require('./transcriptionService');
const { translateText } = require('./translationService');
const { generateSpeech } = require('./ttsService');
const { mergeAudioVideo } = require('../../merge-only/services/ffmpegService');
const { downloadVideo } = require('../../merge-only/services/downloadService');
const { uploadVideo } = require('../../shared/services/r2Service');

/**
 * Process a single dubbing job
 * @param {Object} options - Processing options
 * @param {string} options.jobId - Job identifier
 * @param {string} options.videoPath - Path to video file
 * @param {string} options.sourceLanguage - Source language code
 * @param {string[]} options.targetLanguages - Target language codes
 * @param {Function} options.onProgress - Optional progress callback
 * @returns {Object} Processing results
 */
async function processDubbingJob({ jobId, videoPath, sourceLanguage, targetLanguages, onProgress }) {
  const startTime = Date.now();
  const results = {};
  
  try {
    // Extract audio
    if (onProgress) onProgress('extracting_audio');
    const audioPath = await extractAudio(videoPath);
    
    // Transcribe
    if (onProgress) onProgress('transcribing');
    const transcript = await transcribeAudio(audioPath, sourceLanguage);
    
    // Process each target language
    for (const targetLang of targetLanguages) {
      const langStartTime = Date.now();
      
      try {
        if (onProgress) onProgress('processing', targetLang);
        
        // Translate
        const translation = await translateText(transcript.text, sourceLanguage, targetLang);
        
        // Generate speech
        const dubbedAudioPath = await generateSpeech(translation, targetLang);
        
        // Merge
        const outputFileName = `dubbed_${sourceLanguage}_to_${targetLang}_${Date.now()}.mp4`;
        const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);
        await mergeAudioVideo(videoPath, dubbedAudioPath, outputPath);
        
        // Upload to R2
        const r2Url = await uploadVideo(outputPath, `${jobId}_${targetLang}.mp4`);
        
        const langTime = ((Date.now() - langStartTime) / 1000).toFixed(2);
        
        results[targetLang] = {
          success: true,
          transcript: transcript.text,
          translation,
          video: r2Url,
          processingTime: langTime + 's'
        };
        
        if (onProgress) onProgress('completed', targetLang);
        
      } catch (error) {
        console.error(`[${jobId}] ${targetLang} failed:`, error.message);
        results[targetLang] = {
          success: false,
          error: error.message
        };
        
        if (onProgress) onProgress('failed', targetLang, error.message);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return {
      success: true,
      transcript: transcript.text,
      results,
      totalProcessingTime: totalTime + 's'
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * Process job from video URL
 */
async function processDubbingJobFromUrl({ jobId, videoUrl, sourceLanguage, targetLanguages, onProgress }) {
  // Download video if URL
  let videoPath;
  
  if (videoUrl.startsWith('http')) {
    if (onProgress) onProgress('downloading');
    videoPath = await downloadVideo(videoUrl, jobId);
  } else {
    videoPath = videoUrl.replace(/\\/g, '/');
    if (!fs.existsSync(videoPath)) {
      throw new Error('File not found: ' + videoPath);
    }
  }
  
  // Process the video
  return processDubbingJob({ jobId, videoPath, sourceLanguage, targetLanguages, onProgress });
}

module.exports = {
  processDubbingJob,
  processDubbingJobFromUrl
};
