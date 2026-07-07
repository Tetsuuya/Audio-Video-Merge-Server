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
      outputPath = path.join(videoDir, `${videoName}_audio.wav`);
    }

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    console.log(`🎵 Extracting audio from: ${path.basename(videoPath)}`);

    // FFmpeg command: Extract audio as mono 16kHz WAV
    const command = `ffmpeg -i "${videoPath}" -vn -ar 16000 -ac 1 -acodec pcm_s16le "${outputPath}" -y`;

    // Execute FFmpeg
    const { stdout, stderr } = await execPromise(command);

    // Verify output file was created
    const stats = await fs.stat(outputPath);
    
    console.log(`✓ Audio extracted: ${path.basename(outputPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return outputPath;

  } catch (error) {
    console.error('Audio extraction failed:', error.message);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

module.exports = {
  extractAudio
};