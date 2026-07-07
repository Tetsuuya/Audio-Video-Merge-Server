// test-audio-extraction.js
const { extractAudio } = require('./src/dubbing-pipeline/services/audioExtractionService');
const path = require('path');

async function test() {
  try {
    // Replace with your actual video path
    const videoPath = "C:/Users/Rhenel Jhon Sajol/Downloads/test-sample.mp4";
    
    console.log('Testing audio extraction...\n');
    
    const audioPath = await extractAudio(videoPath);
    
    console.log('\n✅ Test successful!');
    console.log(`Audio saved to: ${audioPath}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

test();