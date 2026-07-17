/**
 * TEXT-TO-SPEECH SERVICE
 * 
 * Purpose: Generate speech from translated text using Kokoro TTS
 * Uses Replicate API with alphanumericuser/kokoro-82m model
 */

const Replicate = require('replicate');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { getVoiceForLanguage, DEFAULT_VOICE } = require('../../config/voices');
const log = require('../../shared/utils/logger');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const KOKORO_MODEL = 'alphanumericuser/kokoro-82m:89b6fa84e4fa2dd6bd3a96be3e1f12827a3516c9fda8fddbac7a0be131c9a6f5';

// Initialize Replicate client
const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN
});

// Language code mapping (full code to single letter for Kokoro)
const LANGUAGE_CODE_MAP = {
  'en': 'a',  // American English
  'es': 'e',  // Spanish
  'fr': 'f',  // French
  'it': 'i',  // Italian
  'pt': 'p',  // Brazilian Portuguese
  'ja': 'j',  // Japanese
  'zh': 'z',  // Mandarin Chinese
  'hi': 'h'   // Hindi
};

/**
 * Download audio file from URL
 * @param {string} url - Audio file URL
 * @param {string} outputPath - Path to save audio file
 * @returns {Promise<string>} - Path to downloaded file
 */
async function downloadAudio(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(outputPath);

    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      require('fs').unlink(outputPath, () => {});
      reject(err);
    });
  });
}

/**
 * Generate speech from text using Kokoro TTS
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code (e.g., 'en', 'es')
 * @param {string} outputPath - Path to save generated audio (optional)
 * @returns {Promise<string>} - Path to generated audio file
 */
async function generateSpeech(text, language = 'en', outputPath = null) {
  try {
    // Select the best voice for the target language from voices.js config
    const voice = getVoiceForLanguage(language);
    const languageCode = LANGUAGE_CODE_MAP[language] || 'a';

    log.step(`TTS  ${language.toUpperCase()}  voice=${voice}  code=${languageCode}`);
    log.detail(`Text: "${text.substring(0, 60)}..."`);

    const output = await replicate.run(
      KOKORO_MODEL,
      {
        input: {
          text: text,
          voice: voice,
          language_code: languageCode,
          speed: 1.0
        }
      }
    );

    log.success(`Replicate TTS done  [${language}]`);

    if (!outputPath) {
      const timestamp = Date.now();
      outputPath = path.join(process.cwd(), 'temp', `tts_${language}_${timestamp}.wav`);
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, output);

    const stats = await fs.stat(outputPath);
    log.success(`Audio saved  ${path.basename(outputPath)}  (${(stats.size / 1024).toFixed(2)} KB)`);

    return outputPath;

  } catch (error) {
    log.error(`TTS failed [${language}]: ${error.message}`);
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

/**
 * Generate speech for multiple languages
 * @param {object} translations - Object with language codes as keys and text as values
 * @returns {Promise<object>} - Object with language codes as keys and audio paths as values
 */
async function batchGenerateSpeech(translations) {
  try {
    const langs = Object.keys(translations);
    log.section(`Batch TTS — ${langs.length} language(s): ${langs.join(', ')}`);

    const audioFiles = {};

    for (const [lang, text] of Object.entries(translations)) {
      audioFiles[lang] = await generateSpeech(text, lang);
    }

    log.success('All TTS files generated');
    return audioFiles;

  } catch (error) {
    log.error(`Batch TTS failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  generateSpeech,
  batchGenerateSpeech
};
