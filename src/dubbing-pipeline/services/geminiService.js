/**
 * GEMINI AI SERVICE
 * 
 * Purpose: Condense translated text when audio duration exceeds target slot by > 12%
 * Uses Google Gemini API (gemini-2.0-flash-lite / flash-lite model - lowest cost & ultra fast)
 */

const axios = require('axios');
const log = require('../../shared/utils/logger');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Shorten a sentence to fit within a target speaking duration using Gemini Flash Lite
 * @param {string} text - Original translated text to shorten
 * @param {string} targetLanguage - Target language code (e.g., 'fr', 'es')
 * @param {number} targetDurationSec - Available duration slot in seconds
 * @returns {Promise<string>} - Shortened text
 */
async function shortenTranslation(text, targetLanguage = 'en', targetDurationSec = 5) {
  if (!GEMINI_API_KEY) {
    log.warn('GEMINI_API_KEY not configured. Skipping Gemini text reduction.');
    return text;
  }

  try {
    // Average TTS speaking rate ~ 3.0 to 3.3 words per second
    const maxWordCount = Math.max(4, Math.floor(targetDurationSec * 3.3));
    const minWordCount = Math.max(3, Math.floor(targetDurationSec * 2.8));
    const currentWordCount = text.trim().split(/\s+/).length;

    log.step(`Gemini 2.5/2.0 Flash Lite [${targetLanguage.toUpperCase()}]  Shortening text  currentWords=${currentWordCount} -> targetWords=${minWordCount}-${maxWordCount}  slot=${targetDurationSec.toFixed(2)}s`);

    const prompt = `You are an expert dubbing translator and script editor.
The following text in language code "${targetLanguage}" is too long to speak within a ${targetDurationSec.toFixed(1)}-second video segment.

Original Text: "${text}"

Task: Rewrite and condense this sentence in natural ${targetLanguage} so it contains BETWEEN ${minWordCount} AND ${maxWordCount} words (aiming as close to ${maxWordCount} words as possible).

Crucial rules:
1. Preserve the core meaning, tone, and important details.
2. Ensure flawless grammar and natural phrasing in ${targetLanguage}.
3. The sentence MUST NOT be too short — it should naturally fill roughly ${(targetDurationSec * 0.95).toFixed(1)} seconds of speech.
4. Do NOT add extra explanations or commentary.
5. Output ONLY the JSON matching the required schema.`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: 'application/json',
        response_schema: {
          type: 'OBJECT',
          properties: {
            shortenedText: { type: 'STRING' },
            wordCount: { type: 'INTEGER' }
          },
          required: ['shortenedText', 'wordCount']
        }
      }
    };

    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    const candidate = response.data?.candidates?.[0];
    const contentText = candidate?.content?.parts?.[0]?.text;

    if (!contentText) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(contentText);
    const resultText = (parsed.shortenedText || text).trim();

    log.success(`Gemini shortened text successfully [${targetLanguage.toUpperCase()}]: "${resultText}" (${parsed.wordCount || resultText.split(/\s+/).length} words)`);
    return resultText;

  } catch (error) {
    const errorMsg = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
    log.error(`Gemini text shortening failed: ${errorMsg}`);
    // Fall back to original text safely
    return text;
  }
}

module.exports = {
  shortenTranslation
};
