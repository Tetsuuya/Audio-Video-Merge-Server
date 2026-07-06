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
  
  console.log(`Running ffmpeg: ${command}`);
  
  try {
    const { stdout, stderr } = await execPromise(command);
    console.log('✓ ffmpeg completed successfully');
    return outputPath;
  } catch (error) {
    console.error('✗ ffmpeg failed:', error.message);
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
    console.error('Failed to get duration:', error.message);
    return 0;
  }
}

module.exports = {
  mergeAudioVideo,
  getDuration
};
