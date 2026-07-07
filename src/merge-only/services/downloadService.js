/**
 * DOWNLOAD SERVICE
 * 
 * Purpose: Download video and audio files from URLs to local temp directory
 * 
 * Responsibilities:
 * - Download files from URLs (videoUrl, audioUrl from request)
 * - Save to temp/ directory with unique filenames
 * - Handle download errors and retries
 * - Validate file types (mp4, mp3, wav, etc.)
 * 
 * Functions:
 * - downloadVideo(url, jobId) -> filePath
 * - downloadAudio(url, language, jobId) -> filePath
 * 
 * Error handling:
 * - Invalid URL
 * - Network errors
 * - File too large
 * - Unsupported format
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Download file from URL to temp directory
 * @param {string} url - File URL
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Path to downloaded file
 */
async function downloadFile(url, filename) {
  const tempDir = path.join(__dirname, '../../temp');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, filename);
  const protocol = url.startsWith('https') ? https : http;
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded: ${filename}`);
        resolve(filePath);
      });
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });
}

/**
 * Download video file
 * @param {string} url - Video URL
 * @param {string} jobId - Job ID for filename
 * @returns {Promise<string>} - Path to downloaded video
 */
async function downloadVideo(url, jobId) {
  const filename = `${jobId}-video.mp4`;
  return downloadFile(url, filename);
}

/**
 * Download audio file
 * @param {string} url - Audio URL
 * @param {string} language - Language code
 * @param {string} jobId - Job ID for filename
 * @returns {Promise<string>} - Path to downloaded audio
 */
async function downloadAudio(url, language, jobId) {
  const ext = path.extname(url) || '.mp3';
  const filename = `${jobId}-audio-${language}${ext}`;
  return downloadFile(url, filename);
}

module.exports = {
  downloadVideo,
  downloadAudio
};
