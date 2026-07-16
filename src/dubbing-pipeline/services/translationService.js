/**
 * TRANSLATION SERVICE
 * 
 * Purpose: Translate text from source language to target language(s)
 * Primary: DeepL API (better quality)
 */

const deepl = require('deepl-node');

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
  
  // DeepL requires specific variants for English and Portuguese when used as target
  if (isTarget) {
    if (code === 'en') return 'EN-US'; // Default to US English
    if (code === 'pt') return 'PT-BR'; // Default to Brazilian Portuguese
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
    console.log(`🌍 Translating ${sourceLang} → ${targetLang}...`);
    
    // Normalize language codes for DeepL
    const sourceNormalized = normalizeLanguageCode(sourceLang, false);
    const targetNormalized = normalizeLanguageCode(targetLang, true);
    
    const result = await translator.translateText(
      text,
      sourceNormalized,
      targetNormalized
    );
    
    console.log(`✓ Translation complete (${result.text.length} chars)`);
    return result.text;
    
  } catch (error) {
    console.error(`Translation failed (${sourceLang} → ${targetLang}):`, error.message);
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
    console.log(`\n📚 Batch translating to ${targetLangs.length} languages...`);
    console.log(`   Source: ${sourceLang}`);
    console.log(`   Targets: ${targetLangs.join(', ')}\n`);
    
    const translations = {};
    
    // Translate to each language sequentially
    for (const targetLang of targetLangs) {
      translations[targetLang] = await translateText(text, sourceLang, targetLang);
    }
    
    console.log(`✓ All translations complete\n`);
    return translations;
    
  } catch (error) {
    console.error('Batch translation failed:', error.message);
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
    console.log(`🌍 Translating array of ${texts.length} segments ${sourceLang} → ${targetLang} in batch...`);
    
    const sourceNormalized = normalizeLanguageCode(sourceLang, false);
    const targetNormalized = normalizeLanguageCode(targetLang, true);
    
    const results = await translator.translateText(
      texts,
      sourceNormalized,
      targetNormalized
    );
    
    console.log(`✓ Batch translation complete`);
    return results.map(r => r.text);
    
  } catch (error) {
    console.error(`Batch translation failed (${sourceLang} → ${targetLang}):`, error.message);
    throw new Error(`Failed to batch translate: ${error.message}`);
  }
}

module.exports = {
  translateText,
  batchTranslate,
  translateTexts
};