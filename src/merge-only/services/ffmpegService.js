/**
 * FFMPEG SERVICE
 * 
 * Purpose: Handle video/audio merging using ffmpeg
 * 
 * Responsibilities:
 * - Merge audio track with video using ffmpeg
 * - Handle audio/video duration mismatches (see decision below)
 * - Preserve video quality
 * - Keep audio/video in sync
 * 
 * DECISION NEEDED (from brief): How to handle duration mismatches?
 * 
 * When dubbed audio duration ≠ video duration, choose ONE approach:
 * 
 * Option A: Trim/pad audio to match video length exactly
 *   - If audio longer: cut it
 *   - If audio shorter: pad with silence
 *   - Pros: Video length stays constant
 *   - Cons: May cut off speech or add awkward silence
 * 
 * Option B: Time-stretch audio with atempo filter
 *   - Speed up/slow down audio slightly to match video
 *   - Pros: No content lost, video length constant
 *   - Cons: May sound unnatural if difference is large
 * 
 * Option C: Extend video to match longer audio
 *   - Freeze last frame if audio is longer
 *   - Trim video if audio is shorter
 *   - Pros: All audio content preserved
 *   - Cons: Video length changes, may look odd
 * 
 * CURRENT IMPLEMENTATION: Option A (trim/pad)
 * Flag this choice with client before finalizing
 * 
 * ffmpeg commands (examples):
 * 
 * Basic merge (replace audio):
 *   ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 output.mp4
 * 
 * With duration handling (Option A - trim/pad):
 *   ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -c:a aac -shortest output.mp4
 * 
 * With time-stretch (Option B):
 *   ffmpeg -i video.mp4 -i audio.mp3 -filter:a "atempo=1.05" -c:v copy output.mp4
 */

const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const log = require('../../shared/utils/logger');

const execPromise = util.promisify(exec);

/**
 * Merge audio with video using ffmpeg
 * @param {string} videoPath - Path to video file
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for output file
 * @returns {Promise<string>} - Path to merged video
 */
async function mergeAudioVideo(videoPath, audioPath, outputPath) {
  // ffmpeg command: replace audio track, copy video stream, trim to shortest
  const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest -y "${outputPath}"`;
  
  log.step(`FFmpeg merge: ${path.basename(videoPath)} + ${path.basename(audioPath)}`);
  
  try {
    const { stdout, stderr } = await execPromise(command);
    log.success('FFmpeg merge complete');
    return outputPath;
  } catch (error) {
    log.error(`FFmpeg merge failed: ${error.message}`);
    throw new Error(`ffmpeg merge failed: ${error.message}`);
  }
}

/**
 * Get video duration using ffprobe
 * @param {string} filePath - Path to video/audio file
 * @returns {Promise<number>} - Duration in seconds
 */
async function getDuration(filePath) {
  const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
  
  try {
    const { stdout } = await execPromise(command);
    return parseFloat(stdout.trim());
  } catch (error) {
    log.warn(`Failed to get duration for ${path.basename(filePath)}: ${error.message}`);
    return 0;
  }
}

/**
 * Speed up audio file using FFmpeg atempo filter
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path to output audio file
 * @param {number} speed - Speed factor (e.g. 1.25)
 * @returns {Promise<string>} - Path to modified audio file
 */
async function speedUpAudio(inputPath, outputPath, speed) {
  let filterStr;
  if (speed >= 0.5 && speed <= 2.0) {
    filterStr = `atempo=${speed.toFixed(4)}`;
  } else {
    let remainingSpeed = speed;
    const filters = [];
    while (remainingSpeed > 2.0) {
      filters.push('atempo=2.0');
      remainingSpeed /= 2.0;
    }
    while (remainingSpeed < 0.5) {
      filters.push('atempo=0.5');
      remainingSpeed /= 0.5;
    }
    filters.push(`atempo=${remainingSpeed.toFixed(4)}`);
    filterStr = filters.join(',');
  }

  const command = `ffmpeg -y -i "${inputPath}" -filter:a "${filterStr}" "${outputPath}"`;
  
  log.step(`Speed adjustment: ${path.basename(inputPath)}  ×${speed.toFixed(3)}`);
  
  try {
    await execPromise(command);
    return outputPath;
  } catch (error) {
    log.error(`Speed adjustment failed: ${error.message}`);
    throw new Error(`FFmpeg speed adjustment failed: ${error.message}`);
  }
}

/**
 * Assemble multiple audio files at specific timestamps into a single audio track
 * @param {Array<Object>} segments - Array of { filePath, start }
 * @param {number} videoDuration - Total duration of the video in seconds
 * @param {string} outputPath - Output path for the mixed audio file
 * @returns {Promise<string>} - Path to the assembled audio file
 */
async function assembleAudioTimeline(segments, videoDuration, outputPath) {
  if (!segments || segments.length === 0) {
    const command = `ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${videoDuration} "${outputPath}"`;
    log.step(`Assembling silent audio timeline  (${videoDuration}s)`);
    try {
      await execPromise(command);
      return outputPath;
    } catch (error) {
      log.error(`Silent timeline generation failed: ${error.message}`);
      throw new Error(`FFmpeg silent timeline generation failed: ${error.message}`);
    }
  }

  // Sort segments chronologically by start time
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start);

  const inputs = [];
  const filterParts = [];
  const concatInputs = [];
  let currentPos = 0;
  let inputIdx = 0;

  for (let i = 0; i < sortedSegments.length; i++) {
    const seg = sortedSegments[i];
    const silenceGap = seg.start - currentPos;

    // Insert silence gap if there is a gap before this segment
    if (silenceGap > 0.01) {
      const silenceIdx = inputIdx++;
      inputs.push(`-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100:d=${silenceGap.toFixed(4)}`);
      concatInputs.push(`[${silenceIdx}:a]`);
    }

    // Insert actual segment audio
    const segIdx = inputIdx++;
    inputs.push(`-i "${seg.filePath}"`);
    concatInputs.push(`[${segIdx}:a]`);

    // Get exact segment duration
    const segDuration = await getDuration(seg.filePath);
    currentPos = seg.start + segDuration;
  }

  // Tail silence to fill remaining video duration
  const tailSilence = videoDuration - currentPos;
  if (tailSilence > 0.01) {
    const tailIdx = inputIdx++;
    inputs.push(`-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100:d=${tailSilence.toFixed(4)}`);
    concatInputs.push(`[${tailIdx}:a]`);
  }

  filterParts.push(`${concatInputs.join('')}concat=n=${concatInputs.length}:v=0:a=1[outa]`);

  const filterComplex = filterParts.join('; ');
  const command = `ffmpeg -y ${inputs.join(' ')} -filter_complex "${filterComplex}" -map "[outa]" "${outputPath}"`;
  
  log.step(`Assembling audio timeline via concat  ${sortedSegments.length} segments (${concatInputs.length} parts)  →  ${videoDuration}s`);
  
  try {
    await execPromise(command);
    return outputPath;
  } catch (error) {
    log.error(`Audio timeline assembly failed: ${error.message}`);
    throw new Error(`FFmpeg audio timeline assembly failed: ${error.message}`);
  }
}

/**
 * Trim audio file to a maximum duration
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path to output audio file
 * @param {number} duration - Max duration in seconds
 * @returns {Promise<string>} - Path to trimmed audio file
 */
async function trimAudio(inputPath, outputPath, duration) {
  const command = `ffmpeg -y -i "${inputPath}" -t ${duration.toFixed(4)} "${outputPath}"`;

  log.step(`Trimming audio to ${duration.toFixed(2)}s: ${path.basename(inputPath)}`);

  try {
    await execPromise(command);
    return outputPath;
  } catch (error) {
    log.error(`Trim failed: ${error.message}`);
    throw new Error(`FFmpeg trim failed: ${error.message}`);
  }
}

module.exports = {
  mergeAudioVideo,
  getDuration,
  speedUpAudio,
  trimAudio,
  assembleAudioTimeline
};
