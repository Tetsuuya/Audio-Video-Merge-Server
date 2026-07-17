/**
 * TRANSLATION SERVICE
 * 
 * Purpose: Translate text from source language to target language(s)
 * Primary: DeepL API (better quality)
 */

const deepl = require('deepl-node');
const log = require('../../shared/utils/logger');

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const translator = new deepl.Translator(DEEPL_API_KEY);

/**
 * Normalize language codes for DeepL API
 * @param {string} langCode - Language code (e.g., 'en', 'es')
 * @param {boolean} isTarget - Whether this is a target language
 * @returns {string} - Normalized language code
 */
function normalizeLanguageCode(langCode, isTarget = false) {
  const code = langCode.toLowerCase();

  if (isTarget) {
    if (code === 'en') return 'EN-US';
    if (code === 'pt') return 'PT-BR';
  }

  return langCode.toUpperCase();
}

/**
 * Translate text using DeepL
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code (e.g., 'en')
 * @param {string} targetLang - Target language code (e.g., 'es')
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, sourceLang, targetLang) {
  try {
    log.step(`Translating  ${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`);

    const sourceNormalized = normalizeLanguageCode(sourceLang, false);
    const targetNormalized = normalizeLanguageCode(targetLang, true);

    const result = await translator.translateText(text, sourceNormalized, targetNormalized);

    log.success(`Translation done  (${result.text.length} chars)`);
    return result.text;

  } catch (error) {
    log.error(`Translation failed [${sourceLang} → ${targetLang}]: ${error.message}`);
    throw new Error(`Failed to translate: ${error.message}`);
  }
}

/**
 * Batch translate to multiple languages
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string[]} targetLangs - Array of target language codes
 * @returns {Promise<object>} - { 'es': '...', 'fr': '...', ... }
 */
async function batchTranslate(text, sourceLang, targetLangs) {
  try {
    log.section(`Batch Translation  |  ${sourceLang.toUpperCase()} → [${targetLangs.join(', ')}]`);

    const translations = {};

    for (const targetLang of targetLangs) {
      translations[targetLang] = await translateText(text, sourceLang, targetLang);
    }

    log.success('All translations complete');
    return translations;

  } catch (error) {
    log.error(`Batch translation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Translate an array of texts using DeepL in a single batch request
 * @param {string[]} texts - Array of texts to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {Promise<string[]>} - Array of translated texts
 */
async function translateTexts(texts, sourceLang, targetLang) {
  if (!texts || texts.length === 0) return [];
  try {
    log.step(`Batch translating ${texts.length} segments  ${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`);

    const sourceNormalized = normalizeLanguageCode(sourceLang, false);
    const targetNormalized = normalizeLanguageCode(targetLang, true);

    const results = await translator.translateText(texts, sourceNormalized, targetNormalized);

    log.success(`Batch translation done  (${texts.length} segments)`);
    return results.map(r => r.text);

  } catch (error) {
    log.error(`Batch translation failed [${sourceLang} → ${targetLang}]: ${error.message}`);
    throw new Error(`Failed to batch translate: ${error.message}`);
  }
}

module.exports = {
  translateText,
  batchTranslate,
  translateTexts
};
