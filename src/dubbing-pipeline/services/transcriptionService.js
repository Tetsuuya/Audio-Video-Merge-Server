/**
 * TRANSCRIPTION SERVICE
 * 
 * Purpose: Convert audio to text using AssemblyAI
 * Takes extracted audio.wav and returns transcript
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const log = require('../../shared/utils/logger');

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

/**
 * Upload audio file to AssemblyAI
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Upload URL
 */
async function uploadAudio(audioPath) {
  try {
    log.step(`Uploading audio to AssemblyAI: ${path.basename(audioPath)}`);

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

    log.success('Audio uploaded to AssemblyAI');
    return response.data.upload_url;

  } catch (error) {
    log.error(`Audio upload failed: ${error.message}`);
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
    log.step(`Creating transcription job  language=${language}`);

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

    log.success(`Transcription job created: ${response.data.id}`);
    return response.data.id;

  } catch (error) {
    log.error(`Transcription job creation failed: ${error.message}`);
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
    log.step(`Polling transcription: ${transcriptId}`);

    while (true) {
      const response = await axios.get(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
        {
          headers: { 'authorization': ASSEMBLYAI_API_KEY }
        }
      );

      const status = response.data.status;

      if (status === 'completed') {
        log.success('Transcription complete');
        return response.data;
      } else if (status === 'error') {
        throw new Error(`Transcription failed: ${response.data.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
      process.stdout.write('.');
    }

  } catch (error) {
    log.error(`Transcription polling failed: ${error.message}`);
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
    log.section(`Transcription  |  ${path.basename(audioPath)}  |  lang=${language}`);

    const uploadUrl = await uploadAudio(audioPath);
    const transcriptId = await createTranscript(uploadUrl, language);
    const transcript = await pollTranscript(transcriptId);

    const result = {
      text: transcript.text,
      words: transcript.words || [],
      duration: transcript.audio_duration,
      language: transcript.language_code
    };

    log.detail(`Preview: "${result.text.substring(0, 100)}..."`);
    log.detail(`Duration: ${result.duration}s  |  Words: ${result.words.length}`);

    return result;

  } catch (error) {
    log.error(`Transcription failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  transcribeAudio,
  uploadAudio,
  createTranscript,
  pollTranscript
};
