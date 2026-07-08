const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { extractAudio } = require('../services/audioExtractionService');
const { transcribeAudio } = require('../services/transcriptionService');
const { translateText } = require('../services/translationService');
const { generateSpeech } = require('../services/ttsService');
const { mergeAudioVideo } = require('../../merge-only/services/ffmpegService');
const { downloadVideo } = require('../../merge-only/services/downloadService');

router.post('/single', async (req, res) => {
  const startTime = Date.now();
  try {
    const { videoUrl, sourceLanguage, targetLanguage } = req.body;
    if (!videoUrl || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    console.log('Starting dubbing job:', videoUrl);
    const jobId = 'job_' + Date.now();
    let videoPath;
    if (videoUrl.startsWith('http')) {
      videoPath = await downloadVideo(videoUrl, jobId);
    } else {
      videoPath = videoUrl.replace(/\\/g, '/');
      if (!fs.existsSync(videoPath)) throw new Error('File not found: ' + videoPath);
    }
    const audioPath = await extractAudio(videoPath);
    const transcript = await transcribeAudio(audioPath, sourceLanguage);
    const translation = await translateText(transcript.text, sourceLanguage, targetLanguage);
    const dubbedAudioPath = await generateSpeech(translation, targetLanguage);
    const outputFileName = 'dubbed_' + sourceLanguage + '_to_' + targetLanguage + '_' + Date.now() + '.mp4';
    const outputPath = path.join(process.cwd(), 'public', 'output', outputFileName);
    await mergeAudioVideo(videoPath, dubbedAudioPath, outputPath);
    const downloadUrl = (process.env.SERVER_URL || 'http://localhost:8080') + '/output/' + outputFileName;
    res.json({ success: true, jobId, sourceLanguage, targetLanguage, transcript: transcript.text, translation, downloadUrl });
  } catch (error) {
    console.error('Dubbing failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
module.exports = router;
