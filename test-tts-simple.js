require('dotenv').config();
const path = require('path');
const { generateSpeech } = require('./src/dubbing-pipeline/services/ttsService');

async function testTTS() {
  console.log('🧪 TESTING TEXT-TO-SPEECH (Kokoro TTS)\n');
  console.log('='.repeat(70));
  console.log('⚠️  NOTE: First run takes 30-60 seconds (cold start)');
  console.log('='.repeat(70));
  console.log('\n');

  try {
    // ===========================================
    // 🔧 CONFIGURE YOUR TEST HERE:
    // ===========================================
    
    // Set your text to convert to speech:
    const text = 'Hello. How are you? Good, and you? Good, thanks. What do you like? I like soccer. Soccer? Very good. And what do you not like? I do not like baseball. Thanks.';
    
    // Set the language:
    const language = 'en'; // Change to: 'es', 'fr', 'it', 'pt', 'ja', 'zh', 'hi'
    
    // ===========================================
    // GENERATE SPEECH
    // ===========================================
    console.log('📍 GENERATING SPEECH');
    console.log('-'.repeat(70));
    console.log(`Text: "${text.substring(0, 80)}..."`);
    console.log(`Language: ${language.toUpperCase()}`);
    console.log(`Voice: af_heart (Grade A)\n`);
    
    const audioFile = await generateSpeech(text, language);

    // ===========================================
    // RESULTS
    // ===========================================
    console.log('='.repeat(70));
    console.log('✅ SPEECH GENERATED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📊 DETAILS:');
    console.log(`   Language: ${language.toUpperCase()}`);
    console.log(`   Voice: af_heart (Grade A)`);
    console.log(`   Text Length: ${text.length} characters`);
    console.log(`   Generated Audio: ${path.basename(audioFile)}`);
    
    console.log('\n📂 Audio File Location:');
    console.log(`   ${audioFile}`);
    
    console.log('\n🎧 Play the audio file to hear the generated speech!');
    console.log('\n🎯 TTS Service: WORKING PERFECTLY!');
    console.log('='.repeat(70));
    console.log('\n');

  } catch (error) {
    console.error('\n❌ TTS TEST FAILED');
    console.error('='.repeat(70));
    console.error('Error:', error.message);
    console.error('\nCommon issues:');
    console.error('1. Invalid Replicate API key');
    console.error('2. Network connection issues');
    console.error('3. Text too long (max ~500 words)');
    console.error('\nStack trace:');
    console.error(error.stack);
  }
}

testTTS();
