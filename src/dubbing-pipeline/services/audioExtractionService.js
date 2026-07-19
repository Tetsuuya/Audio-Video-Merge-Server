/**
 * AUDIO EXTRACTION SERVICE
 * 
 * Purpose: Extract audio from video files for transcription
 * Uses FFmpeg to convert video to mono 16kHz WAV format
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execPromise = promisify(exec);
const log = require('../../shared/utils/logger');


/**
 * Extract audio from video file
 * @param {string} videoPath - Path to input video file
 * @param {string} outputPath - Path to save extracted audio (optional)
 * @returns {Promise<string>} - Path to extracted audio.wav
 */

async function extractAudio(videoPath, outputPath = null) {
  try {
    // Generate output path if not provided
    if (!outputPath) {
      const videoDir = path.dirname(videoPath);
      const videoName = path.basename(videoPath, path.extname(videoPath));
      outputPath = path.join(videoDir, `${videoName}_audio.mp3`);
    }

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    log.step(`Extracting audio from: ${path.basename(videoPath)}`);
    // FFmpeg command: Extract audio as 44.1kHz stereo MP3 for universal AssemblyAI compatibility
    const command = `ffmpeg -i "${videoPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}" -y`;

    // Execute FFmpeg
    const { stdout, stderr } = await execPromise(command);

    // Verify output file was created
    const stats = await fs.stat(outputPath);
    
    log.success(`Audio extracted: ${path.basename(outputPath)}  (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return outputPath;

  } catch (error) {
    log.error(`Audio extraction failed: ${error.message}`);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

module.exports = {
  extractAudio
};