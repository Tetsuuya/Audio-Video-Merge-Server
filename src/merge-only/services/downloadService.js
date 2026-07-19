/**
 * DOWNLOAD SERVICE
 * 
 * Purpose: Download video and audio files from URLs to local temp directory
 * Supports:
 * - YouTube & Social Media URLs (via yt-dlp-exec)
 * - Direct Video/Audio file links (via axios stream with content validation)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const log = require('../../shared/utils/logger');
let ytdlp;
try {
  ytdlp = require('yt-dlp-exec');
} catch (e) {
  ytdlp = null;
}

const { execFile } = require('child_process');

/**
 * Check if URL is YouTube or social media link
 */
function isYouTubeOrSocialUrl(url) {
  return /(?:youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|twitter\.com|x\.com|instagram\.com)/i.test(url);
}

/**
 * Helper to run yt-dlp CLI command with fallback to node module
 */
function runYtDlpCli(url, filePath, extractorArg) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '-o', filePath,
      '-f', 'bestvideo+bestaudio/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-check-certificates',
      '--no-warnings',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];
    if (extractorArg) {
      args.push('--extractor-args', extractorArg);
    }

    execFile('yt-dlp', args, (error, stdout, stderr) => {
      if (!error && fs.existsSync(filePath) && fs.statSync(filePath).size >= 10240) {
        return resolve(filePath);
      }

      if (ytdlp) {
        const ytdlpOpts = {
          output: filePath,
          format: 'bestvideo+bestaudio/best[ext=mp4]/best',
          mergeOutputFormat: 'mp4',
          noCheckCertificates: true,
          noWarnings: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        };
        if (extractorArg) ytdlpOpts.extractorArgs = extractorArg;

        ytdlp(url, ytdlpOpts)
          .then(() => {
            if (fs.existsSync(filePath) && fs.statSync(filePath).size >= 10240) {
              resolve(filePath);
            } else {
              reject(new Error('Downloaded video is missing or under 10KB'));
            }
          })
          .catch(reject);
      } else {
        reject(error || new Error(stderr || 'yt-dlp execution failed'));
      }
    });
  });
}

/**
 * Download YouTube / social media video using yt-dlp
 */
async function downloadYouTubeVideo(url, filePath) {
  log.step(`Downloading YouTube/Social video via yt-dlp: ${url}`);

  const clientStrategies = [
    'youtube:player_client=tv_embedded,android',
    'youtube:player_client=tv_embedded',
    'youtube:player_client=android,web',
    'youtube:player_client=ios',
    'youtube:player_client=mweb',
    null
  ];

  let lastError;

  for (const extractorArg of clientStrategies) {
    try {
      await runYtDlpCli(url, filePath, extractorArg);

      if (fs.existsSync(filePath) && fs.statSync(filePath).size >= 10240) {
        const stats = fs.statSync(filePath);
        log.success(`Video downloaded via yt-dlp: ${path.basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return filePath;
      }
    } catch (err) {
      lastError = err;
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }
  }

  const errorMsg = lastError ? (lastError.stderr || lastError.message) : 'Downloaded file is missing or corrupted.';
  log.error(`yt-dlp download failed: ${errorMsg}`);
  throw new Error(`Failed to download YouTube video: ${errorMsg}`);
}

/**
 * Download direct file link using axios
 */
async function downloadDirectFile(url, filePath) {
  log.step(`Downloading direct file URL: ${url}`);

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      maxRedirects: 10,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 300000 // 5 minutes
    });

    const contentType = (response.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html')) {
      throw new Error(`The URL returned an HTML web page (Content-Type: ${contentType}) instead of a media file. Please provide a direct video link or valid YouTube URL.`);
    }

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        writer.close();
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          reject(new Error('Downloaded file is empty (0 bytes).'));
          return;
        }
        const stats = fs.statSync(filePath);
        log.success(`Direct file downloaded: ${path.basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve(filePath);
      });

      writer.on('error', (err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        reject(err);
      });
    });
  } catch (err) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    log.error(`Direct file download failed: ${err.message}`);
    throw new Error(`Failed to download file from URL: ${err.message}`);
  }
}

/**
 * Download video file (from YouTube or direct URL)
 * @param {string} url - Video URL
 * @param {string} jobId - Job ID for filename
 * @returns {Promise<string>} - Path to downloaded video
 */
async function downloadVideo(url, jobId) {
  const tempDir = path.join(__dirname, '../../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, `${jobId}-video.mp4`);

  if (isYouTubeOrSocialUrl(url)) {
    return downloadYouTubeVideo(url, filePath);
  } else {
    return downloadDirectFile(url, filePath);
  }
}

/**
 * Download audio file
 * @param {string} url - Audio URL
 * @param {string} language - Language code
 * @param {string} jobId - Job ID for filename
 * @returns {Promise<string>} - Path to downloaded audio
 */
async function downloadAudio(url, language, jobId) {
  const tempDir = path.join(__dirname, '../../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const ext = path.extname(url).split('?')[0] || '.mp3';
  const filePath = path.join(tempDir, `${jobId}-audio-${language}${ext}`);

  if (isYouTubeOrSocialUrl(url)) {
    return downloadYouTubeVideo(url, filePath);
  } else {
    return downloadDirectFile(url, filePath);
  }
}

module.exports = {
  downloadVideo,
  downloadAudio
};
