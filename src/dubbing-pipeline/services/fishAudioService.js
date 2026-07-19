/**
 * FISH AUDIO TTS SERVICE
 *
 * Purpose: Generate speech from text using Fish Audio API
 * Endpoint: POST https://api.fish.audio/v1/tts
 * Docs: https://docs.fish.audio/features/text-to-speech
 *
 * Supports:
 * - Built-in Fish Audio voices (pass referenceId from Voice Library)
 * - Cloned voices (pass the reference_id of a cloned voice model)
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const log = require('../../shared/utils/logger');
const { resolveVoiceId } = require('../../config/voices');

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
const FISH_AUDIO_API_URL = 'https://api.fish.audio/v1/tts';
const FISH_AUDIO_MODEL = process.env.FISH_AUDIO_MODEL || 's2.1-pro-free'; // free tier by default

/**
 * Generate speech from text using Fish Audio
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code (e.g., 'en', 'fr')
 * @param {string} outputPath - Path to save generated audio
 * @param {string} referenceId - Fish Audio voice model ID (optional, uses default if not set)
 * @returns {Promise<string>} - Path to generated audio file
 */
async function generateSpeechFish(text, language = 'en', outputPath = null, referenceId = null) {
  try {
    const voiceId = resolveVoiceId('fish', language, referenceId);

    log.step(`Fish Audio TTS  ${language.toUpperCase()}  model=${FISH_AUDIO_MODEL}${voiceId ? `  voice=${voiceId}` : '  voice=default'}`);
    log.detail(`Text: "${text.substring(0, 60)}..."`);

    const payload = {
      text,
      format: 'wav',
      latency: 'normal',
      normalize: true,
    };

    // Attach reference_id
    if (voiceId) {
      payload.reference_id = voiceId;
    }

    const response = await axios.post(
      FISH_AUDIO_API_URL,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
          'Content-Type': 'application/json',
          'model': FISH_AUDIO_MODEL,
        },
        responseType: 'arraybuffer', // audio binary
        timeout: 120000, // 2 min timeout
      }
    );

    log.success(`Fish Audio TTS done  [${language}]`);

    if (!outputPath) {
      const timestamp = Date.now();
      outputPath = path.join(process.cwd(), 'temp', `tts_fish_${language}_${timestamp}.wav`);
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from(response.data));

    const stats = await fs.stat(outputPath);
    log.success(`Audio saved  ${path.basename(outputPath)}  (${(stats.size / 1024).toFixed(2)} KB)`);

    return outputPath;

  } catch (error) {
    const msg = error.response
      ? `HTTP ${error.response.status}: ${Buffer.from(error.response.data).toString('utf8').substring(0, 200)}`
      : error.message;
    log.error(`Fish Audio TTS failed [${language}]: ${msg}`);
    throw new Error(`Fish Audio TTS failed: ${msg}`);
  }
}

module.exports = {
  generateSpeechFish
};
