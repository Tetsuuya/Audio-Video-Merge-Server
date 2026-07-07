/**
 * TRANSCRIPTION SERVICE
 * 
 * Purpose: Convert audio to text using AssemblyAI
 * Takes extracted audio.wav and returns transcript
 */


const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';


/**
 * Upload audio file to AssemblyAI
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Upload URL
 */

async function uploadAudio(audioPath) {
  try {
    console.log(`📤 Uploading audio: ${path.basename(audioPath)}`);

    const audioData = fs.readFileSync(audioPath);

    const response = await axios.post(
      `${ASSEMBLYAI_BASE_URL}/upload`,
      audioData,
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/octet-stream'
        }
      }
    );

    console.log(`✓ Audio uploaded`);
    return response.data.upload_url;

  } catch (error) {
    console.error('Upload failed:', error.message);
    throw new Error(`Failed to upload audio: ${error.message}`);
  }
}

/**
 * Create transcription job
 * @param {string} audioUrl - AssemblyAI upload URL
 * @param {string} language - Language code (e.g., 'en', 'es')
 * @returns {Promise<string>} - Transcription ID
 */

async function createTranscript(audioUrl, language = 'en') {
  try {
    console.log(`Creating transcription job (language: ${language})...`);

    const response = await axios.post(
      `${ASSEMBLYAI_BASE_URL}/transcript`,
      {
        audio_url: audioUrl,
        language_code: language
      },
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    console.log(`✓ Transcription job created: ${response.data.id}`);
    return response.data.id;

  } catch (error) {
    console.error('Transcription creation failed:', error.message);
    throw new Error(`Failed to create transcript: ${error.message}`);
  }
}

/**
 * Poll for transcription completion
 * @param {string} transcriptId - Transcription ID
 * @returns {Promise<object>} - Transcript data
 */
async function pollTranscript(transcriptId) {
  try {
    console.log(`⏳ Waiting for transcription to complete...`);

    while (true) {
      const response = await axios.get(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
        {
          headers: {
            'authorization': ASSEMBLYAI_API_KEY
          }
        }
      );

      const status = response.data.status;

      if (status === 'completed') {
        console.log(`✓ Transcription complete!`);
        return response.data;
      } else if (status === 'error') {
        throw new Error(`Transcription failed: ${response.data.error}`);
      }

      // Wait 3 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 3000));
      process.stdout.write('.');
    }

  } catch (error) {
    console.error('Polling failed:', error.message);
    throw new Error(`Failed to get transcript: ${error.message}`);
  }
}

/**
 * Transcribe audio file (main function)
 * @param {string} audioPath - Path to audio.wav file
 * @param {string} language - Language code (default: 'en')
 * @returns {Promise<object>} - { text, words, duration }
 */
async function transcribeAudio(audioPath, language = 'en') {
  try {
    console.log(`\nStarting transcription...`);
    console.log(`   Audio: ${path.basename(audioPath)}`);
    console.log(`   Language: ${language}\n`);

    // Step 1: Upload audio
    const uploadUrl = await uploadAudio(audioPath);

    // Step 2: Create transcript job
    const transcriptId = await createTranscript(uploadUrl, language);

    // Step 3: Wait for completion
    const transcript = await pollTranscript(transcriptId);

    // Extract useful data
    const result = {
      text: transcript.text,
      words: transcript.words || [],
      duration: transcript.audio_duration,
      language: transcript.language_code
    };

    console.log(`\nTranscript preview:`);
    console.log(`   "${result.text.substring(0, 100)}..."`);
    console.log(`   Duration: ${result.duration}s`);
    console.log(`   Words: ${result.words.length}\n`);

    return result;

  } catch (error) {
    console.error('Transcription failed:', error.message);
    throw error;
  }
}

module.exports = {
  transcribeAudio,
  uploadAudio,
  createTranscript,
  pollTranscript
};