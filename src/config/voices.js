/**
 * VOICE CONFIGURATION
 * 
 * Best graded voices per language for Kokoro TTS
 * Based on VOICES.md from hexgrad/Kokoro-82M
 * 
 * Voice Grades:
 * - A: Highest quality (af_heart, af_bella)
 * - B-: Good quality (bf_emma, ff_siwis)
 * - C to C+: Acceptable quality
 * - D: Lower quality
 */

const BEST_VOICES_PER_LANGUAGE = {
  // English
  'en': 'af_heart',        // Grade A (best overall)
  'en-US': 'af_heart',     // Grade A
  'en-GB': 'bf_emma',      // Grade B- (British)
  
  // Other languages
  'es': 'ef_dora',         // Spanish Female
  'fr': 'ff_siwis',        // Grade B- (only French voice)
  'it': 'if_sara',         // Grade C (Italian Female)
  'ja': 'jf_alpha',        // Grade C+ (best Japanese)
  'zh': 'zf_xiaobei',      // Grade D (Mandarin Chinese)
  'hi': 'hf_alpha',        // Grade C (Hindi)
  'pt': 'pf_dora',         // Portuguese
  'pt-BR': 'pf_dora'       // Brazilian Portuguese
};

const DEFAULT_VOICE = 'af_heart'; // Grade A - fallback for unsupported languages

const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'it', 'pt', 'hi', 'ja', 'zh'
];

/**
 * Get the best voice for a given language
 * @param {string} language - Language code (e.g., 'en', 'es', 'fr')
 * @returns {string} - Voice ID for Kokoro TTS
 */
function getVoiceForLanguage(language) {
  return BEST_VOICES_PER_LANGUAGE[language] || DEFAULT_VOICE;
}

/**
 * Check if a language is supported
 * @param {string} language - Language code
 * @returns {boolean}
 */
function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

module.exports = {
  BEST_VOICES_PER_LANGUAGE,
  DEFAULT_VOICE,
  SUPPORTED_LANGUAGES,
  getVoiceForLanguage,
  isLanguageSupported
};
