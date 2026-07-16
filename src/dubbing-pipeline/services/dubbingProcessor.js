/**
 * DUBBING PROCESSOR SERVICE
 * 
 * Shared processing logic for both sync and async dubbing
 */

const path = require('path');
const fs = require('fs');
const { extractAudio } = require('./audioExtractionService');
const { transcribeAudio } = require('./transcriptionService');
const { translateText, translateTexts } = require('./translationService');
const { generateSpeech } = require('./ttsService');
const { mergeAudioVideo, speedUpAudio, assembleAudioTimeline, getDuration } = require('../../merge-only/services/ffmpegService');
const { downloadVideo } = require('../../merge-only/services/downloadService');
const { uploadVideo } = require('../../shared/services/r2Service');

/**
 * Group word-level timestamps from AssemblyAI into sentence-level segments
 * @param {Array<Object>} words - Array of { text, start, end } (start/end in milliseconds)
 * @returns {Array<Object>} - Array of segments { text, start, end, duration } (start/end/duration in seconds)
 */
function groupWordsIntoSentences(words) {
  if (!words || words.length === 0) return [];
  
  const segments = [];
  let currentWords = [];
  const maxGapMs = 1500; // 1.5 seconds gap forces a sentence split
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentWords.push(word);
    
    const isPunctuationEnd = /[.!?]$/.test(word.text.trim());
    const isLastWord = i === words.length - 1;
    
    let hasLargeGap = false;
    if (!isLastWord) {
      const nextWord = words[i + 1];
      const gap = nextWord.start - word.end;
      if (gap > maxGapMs) {
        hasLargeGap = true;
      }
    }
    
    if (isPunctuationEnd || isLastWord || hasLargeGap) {
      const firstWord = currentWords[0];
      const lastWord = currentWords[currentWords.length - 1];
      
      const startSec = firstWord.start / 1000;
      const endSec = lastWord.end / 1000;
      
      segments.push({
        text: currentWords.map(w => w.text).join(' '),
        start: startSec,
        end: endSec,
        duration: endSec - startSec
      });
      
      currentWords = [];
    }
  }
  
  return segments;
}

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
  const tempFilesToCleanup = [];
  
  try {
    const videoDuration = await getDuration(videoPath);
    console.log(`📹 Video duration: ${videoDuration}s`);
    
    if (onProgress) onProgress('extracting_audio');
    const audioPath = await extractAudio(videoPath);
    tempFilesToCleanup.push(audioPath);
    
    if (onProgress) onProgress('transcribing');
    const transcript = await transcribeAudio(audioPath, sourceLanguage);
    
    const segments = groupWordsIntoSentences(transcript.words);
    console.log(`Parsed ${segments.length} sentence segments for dubbing.`);
    
    for (const targetLang of targetLanguages) {
      const langStartTime = Date.now();
      const langTempFiles = [];
      
      try {
        if (onProgress) onProgress('processing', targetLang);
        
        let translatedSegments = [];
        if (segments.length > 0) {
          const textsToTranslate = segments.map(s => s.text);
          const translatedTexts = await translateTexts(textsToTranslate, sourceLanguage, targetLang);
          
          translatedSegments = segments.map((seg, idx) => ({
            ...seg,
            translatedText: translatedTexts[idx] || seg.text
          }));
        }
        
        const ttsPromises = translatedSegments.map(async (seg, idx) => {
          const tempOutPath = path.join(process.cwd(), 'temp', `seg_${jobId}_${targetLang}_${idx}_orig.wav`);
          const generatedPath = await generateSpeech(seg.translatedText, targetLang, tempOutPath);
          langTempFiles.push(generatedPath);
          return {
            ...seg,
            rawTtsPath: generatedPath
          };
        });
        
        const segmentsWithTts = await Promise.all(ttsPromises);
        
        const adjustedSegments = [];
        for (let i = 0; i < segmentsWithTts.length; i++) {
          const seg = segmentsWithTts[i];
          const actualDuration = await getDuration(seg.rawTtsPath);
          const targetDuration = seg.duration;
          
          let finalTtsPath = seg.rawTtsPath;
          
          if (actualDuration > targetDuration && targetDuration > 0) {
            const speed = actualDuration / targetDuration;
            const cappedSpeed = Math.min(2.0, speed);
            
            console.log(`[Segment ${i}] Actual: ${actualDuration.toFixed(2)}s, Target: ${targetDuration.toFixed(2)}s. Speed factor: ${speed.toFixed(2)} (capped at ${cappedSpeed.toFixed(2)})`);
            
            const speedPath = path.join(process.cwd(), 'temp', `seg_${jobId}_${targetLang}_${i}_speed.wav`);
            await speedUpAudio(seg.rawTtsPath, speedPath, cappedSpeed);
            langTempFiles.push(speedPath);
            finalTtsPath = speedPath;
          } else {
            console.log(`[Segment ${i}] Actual: ${actualDuration.toFixed(2)}s, Target: ${targetDuration.toFixed(2)}s. No speed adjustment needed.`);
          }
          
          adjustedSegments.push({
            filePath: finalTtsPath,
            start: seg.start
          });
        }
        
        const assembledAudioPath = path.join(process.cwd(), 'temp', `assembled_${jobId}_${targetLang}.wav`);
        await assembleAudioTimeline(adjustedSegments, videoDuration, assembledAudioPath);
        langTempFiles.push(assembledAudioPath);
        
        const outputFileName = `dubbed_${sourceLanguage}_to_${targetLang}_${Date.now()}.mp4`;
        const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);
        
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
        
        await mergeAudioVideo(videoPath, assembledAudioPath, outputPath);
        
        const r2Url = await uploadVideo(outputPath, `${jobId}_${targetLang}.mp4`);
        
        const langTime = ((Date.now() - langStartTime) / 1000).toFixed(2);
        
        const fullTranslation = translatedSegments.map(s => s.translatedText).join(' ');
        
        results[targetLang] = {
          success: true,
          transcript: transcript.text,
          translation: fullTranslation,
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
      } finally {
        for (const file of langTempFiles) {
          try {
            if (fs.existsSync(file)) {
              await fs.promises.unlink(file);
            }
          } catch (cleanupErr) {
            console.warn(`Failed to delete temporary file ${file}:`, cleanupErr.message);
          }
        }
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
  } finally {
    for (const file of tempFilesToCleanup) {
      try {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file);
        }
      } catch (cleanupErr) {
        console.warn(`Failed to delete temporary file ${file}:`, cleanupErr.message);
      }
    }
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
