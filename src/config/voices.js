/**
 * VOICE CONFIGURATION & SMART FALLBACK RESOLVER
 * 
 * Configures Kokoro Grade A voices, Fish Audio default voice IDs per language,
 * and provides smart fallback resolution (reverting to default voice if requested ID is invalid or missing).
 */

const BEST_VOICES_PER_LANGUAGE = {
  // English (3 Grade A choices available: af_heart, af_bella, am_adam)
  'en': 'af_heart',        // Grade A (Default)
  'en-US': 'af_heart',
  'en-GB': 'bf_emma',
  
  // Other supported languages
  'es': 'ef_dora',         // Spanish Female
  'fr': 'ff_siwis',        // French Female
  'it': 'if_sara',         // Italian Female
  'pt': 'pf_dora',         // Portuguese Female
  'ja': 'jf_alpha',        // Japanese Female
  'tl': 'af_heart',        // Tagalog / Filipino (Kokoro fallback)
  'hi': 'hf_alpha'         // Hindi Female
};

// Graded voices per language (for UI and validation)
const KOKORO_VOICE_PRESETS = {
  'en': [
    { id: 'af_heart', grade: 'Grade A', label: 'af_heart (Heart - Female, Grade A)' },
    { id: 'af_bella', grade: 'Grade A', label: 'af_bella (Bella - Female, Grade A)' },
    { id: 'af_nicole', grade: 'Grade A-', label: 'af_nicole (Nicole - Female, Grade A-)' },
    { id: 'af_aoede', grade: 'Grade A-', label: 'af_aoede (Aoede - Female, Grade A-)' },
    { id: 'am_adam', grade: 'Grade A-', label: 'am_adam (Adam - Male, Grade A-)' },
    { id: 'am_michael', grade: 'Grade A-', label: 'am_michael (Michael - Male, Grade A-)' },
    { id: 'bf_emma', grade: 'Grade B+', label: 'bf_emma (Emma - UK Female, Grade B+)' },
    { id: 'bm_george', grade: 'Grade B+', label: 'bm_george (George - UK Male, Grade B+)' }
  ],
  'es': [{ id: 'ef_dora', grade: 'Grade B+', label: 'ef_dora (Dora - Female, Grade B+)' }],
  'fr': [{ id: 'ff_siwis', grade: 'Grade B-', label: 'ff_siwis (Siwis - Female, Grade B-)' }],
  'it': [{ id: 'if_sara', grade: 'Grade C+', label: 'if_sara (Sara - Female, Grade C+)' }],
  'pt': [{ id: 'pf_dora', grade: 'Grade B+', label: 'pf_dora (Dora - Female, Grade B+)' }],
  'ja': [{ id: 'jf_alpha', grade: 'Grade B', label: 'jf_alpha (Alpha - Female, Grade B)' }],
  'tl': [{ id: 'af_heart', grade: 'Grade A', label: 'af_heart (Heart - Female, Grade A)' }],
  'hi': [{ id: 'hf_alpha', grade: 'Grade C', label: 'hf_alpha (Alpha - Female, Grade C)' }]
};

const ALL_VALID_KOKORO_VOICES = [
  'af_heart', 'af_bella', 'af_nicole', 'af_aoede', 'am_adam', 'am_michael',
  'bf_emma', 'bm_george', 'ef_dora', 'ff_siwis', 'if_sara', 'pf_dora', 'jf_alpha', 'hf_alpha'
];

// Hardcoded Fish Audio Voice Registry per language (Male & Female)
const FISH_AUDIO_VOICES_REGISTRY = {
  'en': {
    female: process.env.FISH_AUDIO_VOICE_EN_FEMALE || 'b545c585f631496c914815291da4e893',
    male: process.env.FISH_AUDIO_VOICE_EN_MALE || 'd8a1340984ee4b63ad1ffae27a6a4339'
  },
  'es': {
    female: process.env.FISH_AUDIO_VOICE_ES_FEMALE || '87603dd57ecb417e8c57fd4362af1cee',
    male: process.env.FISH_AUDIO_VOICE_ES_MALE || '8d2c17a9b26d4d83888ea67a1ee565b2'
  },
  'fr': {
    female: process.env.FISH_AUDIO_VOICE_FR_FEMALE || '656cde69eff3483b933b8d2ffd388c3c',
    male: process.env.FISH_AUDIO_VOICE_FR_MALE || '3bce5f0710f949888abe982ded1ef731'
  },
  'it': {
    female: process.env.FISH_AUDIO_VOICE_IT_FEMALE || '656cde69eff3483b933b8d2ffd388c3c',
    male: process.env.FISH_AUDIO_VOICE_IT_MALE || '3bce5f0710f949888abe982ded1ef731'
  },
  'pt': {
    female: process.env.FISH_AUDIO_VOICE_PT_FEMALE || '302d4d27c9344460a815ee46efdd5cf0',
    male: process.env.FISH_AUDIO_VOICE_PT_MALE || '0ba1afd27db44eb2b4cb27fd331b93aa'
  },
  'ja': {
    female: process.env.FISH_AUDIO_VOICE_JA_FEMALE || 'c13253b3e1fa4580b1295ef7c7e96c41',
    male: process.env.FISH_AUDIO_VOICE_JA_MALE || '45c5d3723c9c42f598e4776dcfd5f02d'
  },
  'tl': {
    female: process.env.FISH_AUDIO_VOICE_TL_FEMALE || '701712d9d2194ebd8c0ea782907ceb38',
    male: process.env.FISH_AUDIO_VOICE_TL_MALE || '1c25b1a3f43546a5bc4e1568e1ed597e'
  },
  'hi': {
    female: process.env.FISH_AUDIO_VOICE_HI_FEMALE || '6904263ba877477fa4ac4a58830126a1',
    male: process.env.FISH_AUDIO_VOICE_HI_MALE || 'b422631422de4186855e9bb1d285a5bd'
  }
};

const DEFAULT_GLOBAL_FISH_VOICE = '9f0465b5f2a34defbd25e9cf29cb3c23';
const DEFAULT_VOICE = 'af_heart';
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'it', 'pt', 'ja', 'tl', 'hi'];

/**
 * Get the best voice for a given language
 */
function getVoiceForLanguage(language) {
  return BEST_VOICES_PER_LANGUAGE[language] || DEFAULT_VOICE;
}

/**
 * Resolve voice ID with smart fallback (reverts to default if requested ID is invalid or missing)
 * @param {string} engine - 'kokoro' or 'fish'
 * @param {string} language - Target language code (e.g. 'en', 'es')
 * @param {string|null} requestedVoiceId - Voice ID passed by user (or null)
 * @returns {string} - Valid resolved voice ID
 */
function resolveVoiceId(engine, language, requestedVoiceId = null) {
  const langKey = (language || 'en').toLowerCase();
  const defaultKokoroVoice = BEST_VOICES_PER_LANGUAGE[langKey] || DEFAULT_VOICE;
  const langFishVoices = FISH_AUDIO_VOICES_REGISTRY[langKey] || { female: DEFAULT_GLOBAL_FISH_VOICE, male: DEFAULT_GLOBAL_FISH_VOICE };

  if (engine === 'fish') {
    if (!requestedVoiceId || typeof requestedVoiceId !== 'string' || requestedVoiceId.trim().length === 0) {
      return langFishVoices.female;
    }

    const cleanId = requestedVoiceId.trim().toLowerCase();

    if (cleanId === '1' || cleanId === 'female' || cleanId === 'v1' || cleanId === 'id1') {
      return langFishVoices.female;
    }

    if (cleanId === '2' || cleanId === 'male' || cleanId === 'v2' || cleanId === 'id2') {
      return langFishVoices.male;
    }

    // Custom voice ID passed (e.g. 32-char hex string)
    if (requestedVoiceId.trim().length >= 10) {
      return requestedVoiceId.trim();
    }

    // Invalid ID (e.g. "10" or "id5") -> Revert to Voice #1 (Female default)
    console.warn(`[Voice Resolver] Invalid Fish Audio voice ID "${requestedVoiceId}" for language "${language}". Reverting to Voice #1 (female default).`);
    return langFishVoices.female;
  }

  // Kokoro engine
  if (requestedVoiceId && typeof requestedVoiceId === 'string' && requestedVoiceId.trim().length > 0) {
    const cleanId = requestedVoiceId.trim();
    if (ALL_VALID_KOKORO_VOICES.includes(cleanId)) {
      return cleanId;
    }
    console.warn(`[Voice Resolver] Invalid Kokoro voice ID "${requestedVoiceId}" for language "${language}". Reverting to default voice: "${defaultKokoroVoice}"`);
  }

  return defaultKokoroVoice;
}

/**
 * Check if a language is supported
 */
function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

module.exports = {
  BEST_VOICES_PER_LANGUAGE,
  KOKORO_VOICE_PRESETS,
  ALL_VALID_KOKORO_VOICES,
  FISH_AUDIO_VOICES_REGISTRY,
  DEFAULT_VOICE,
  SUPPORTED_LANGUAGES,
  getVoiceForLanguage,
  resolveVoiceId,
  isLanguageSupported
};
