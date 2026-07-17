/**
 * DUBBING PROCESSOR SERVICE
 * 
 * Shared processing logic for both sync and async dubbing
 */

const path = require('path');
const fs = require('fs');
const log = require('../../shared/utils/logger');
const { extractAudio } = require('./audioExtractionService');
const { transcribeAudio } = require('./transcriptionService');
const { translateText, translateTexts } = require('./translationService');
const { generateSpeech } = require('./ttsService');
const { mergeAudioVideo, speedUpAudio, assembleAudioTimeline, getDuration, trimAudio } = require('../../merge-only/services/ffmpegService');
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
  const timings = {}; // per-language timing breakdowns
  const tempFilesToCleanup = [];
  
  try {
    const videoDuration = await getDuration(videoPath);
    log.info(`Video duration: ${videoDuration}s`);
    
    if (onProgress) onProgress('extracting_audio');
    const t0 = Date.now();
    const audioPath = await extractAudio(videoPath);
    tempFilesToCleanup.push(audioPath);
    const extractionDuration = (Date.now() - t0) / 1000;
    
    if (onProgress) onProgress('transcribing');
    const t1 = Date.now();
    const transcript = await transcribeAudio(audioPath, sourceLanguage);
    const transcriptionDuration = (Date.now() - t1) / 1000;
    
    const segments = groupWordsIntoSentences(transcript.words);
    log.info(`Segmented transcript into ${segments.length} sentences`);
    
    for (const targetLang of targetLanguages) {
      const langStartTime = Date.now();
      const langTempFiles = [];
      const langTimings = {};
      
      try {
        if (onProgress) onProgress('processing', targetLang);
        
        log.section(`Processing language: ${targetLang.toUpperCase()}`);
        
        let translatedSegments = [];
        if (segments.length > 0) {
          const tTranslate = Date.now();
          const textsToTranslate = segments.map(s => s.text);
          const translatedTexts = await translateTexts(textsToTranslate, sourceLanguage, targetLang);
          langTimings.translation = (Date.now() - tTranslate) / 1000;
          
          translatedSegments = segments.map((seg, idx) => ({
            ...seg,
            translatedText: translatedTexts[idx] || seg.text
          }));
        }
        
        const tTts = Date.now();
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
        langTimings.tts = (Date.now() - tTts) / 1000;
        
        const adjustedSegments = [];
        for (let i = 0; i < segmentsWithTts.length; i++) {
          const seg = segmentsWithTts[i];
          const actualDuration = await getDuration(seg.rawTtsPath);

          // Calculate the available slot: from this segment's start to the next segment's start.
          // This guarantees no overlap regardless of how long TTS produced.
          const nextSegStart = i < segmentsWithTts.length - 1
            ? segmentsWithTts[i + 1].start
            : videoDuration;
          const availableSlot = nextSegStart - seg.start;
          const targetDuration = Math.max(availableSlot, 0.1); // never zero

          let finalTtsPath = seg.rawTtsPath;

          if (actualDuration > targetDuration) {
            const speed = actualDuration / targetDuration;

            log.detail(`Seg ${i}: actual=${actualDuration.toFixed(2)}s  slot=${targetDuration.toFixed(2)}s  speed=${speed.toFixed(2)}x`);

            const speedPath = path.join(process.cwd(), 'temp', `seg_${jobId}_${targetLang}_${i}_speed.wav`);
            await speedUpAudio(seg.rawTtsPath, speedPath, speed);
            langTempFiles.push(speedPath);

            // If speed ratio was extreme (>3x), trim to slot as a hard guarantee
            const finalDuration = await getDuration(speedPath);
            if (finalDuration > targetDuration + 0.05) {
              const trimPath = path.join(process.cwd(), 'temp', `seg_${jobId}_${targetLang}_${i}_trim.wav`);
              await trimAudio(speedPath, trimPath, targetDuration);
              langTempFiles.push(trimPath);
              finalTtsPath = trimPath;
              log.detail(`Seg ${i}: trimmed to ${targetDuration.toFixed(2)}s to prevent overlap`);
            } else {
              finalTtsPath = speedPath;
            }
          } else {
            log.detail(`Seg ${i}: actual=${actualDuration.toFixed(2)}s  slot=${targetDuration.toFixed(2)}s  ok`);
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
        
        const tMerge = Date.now();
        await mergeAudioVideo(videoPath, assembledAudioPath, outputPath);
        langTimings.merge = (Date.now() - tMerge) / 1000;
        
        const tUpload = Date.now();
        const r2Url = await uploadVideo(outputPath, `${jobId}_${targetLang}.mp4`);
        langTimings.upload = (Date.now() - tUpload) / 1000;
        
        const langTime = (Date.now() - langStartTime) / 1000;
        langTimings.total = parseFloat(langTime.toFixed(2));
        langTimings.extraction = parseFloat(extractionDuration.toFixed(2));
        langTimings.transcription = parseFloat(transcriptionDuration.toFixed(2));
        langTimings.translation = parseFloat((langTimings.translation || 0).toFixed(2));
        langTimings.tts = parseFloat((langTimings.tts || 0).toFixed(2));
        langTimings.merge = parseFloat((langTimings.merge || 0).toFixed(2));
        langTimings.upload = parseFloat((langTimings.upload || 0).toFixed(2));
        
        timings[targetLang] = langTimings;
        
        const fullTranslation = translatedSegments.map(s => s.translatedText).join(' ');
        
        results[targetLang] = {
          success: true,
          transcript: transcript.text,
          translation: fullTranslation,
          video: r2Url
        };
        
        if (onProgress) onProgress('completed', targetLang);
        
      } catch (error) {
        log.error(`Language [${targetLang}] failed: ${error.message}`);
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
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    return {
      success: true,
      transcript: transcript.text,
      results,
      metrics: {
        total_duration: parseFloat(totalTime.toFixed(2)),
        extraction_duration: parseFloat(extractionDuration.toFixed(2)),
        transcription_duration: parseFloat(transcriptionDuration.toFixed(2)),
        tts_duration: parseFloat(Object.values(timings).reduce((sum, t) => sum + (t.tts || 0), 0).toFixed(2)),
        translation_duration: parseFloat(Object.values(timings).reduce((sum, t) => sum + (t.translation || 0), 0).toFixed(2)),
        merge_duration: parseFloat(Object.values(timings).reduce((sum, t) => sum + (t.merge || 0), 0).toFixed(2)),
        upload_duration: parseFloat(Object.values(timings).reduce((sum, t) => sum + (t.upload || 0), 0).toFixed(2)),
        segments_count: segments.length,
        languages_processed: Object.keys(results).length
      }
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
