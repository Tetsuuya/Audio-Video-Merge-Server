# Full Dubbing Pipeline - Implementation Plan

**Project:** Audio-Video Merge Server → Full Dubbing Pipeline  
**Timeline:** ~17 days  
**Strategy:** Keep existing merge API, build new dubbing pipeline that uses it internally

---

## 🏗️ ARCHITECTURE OVERVIEW

### Two Separate API Endpoints

#### **1. Merge-Only API (Already Built ✅)**
```
POST /test/merge-one
POST /test/merge-multiple
POST /merge (production)
```
- **Purpose:** Merge pre-existing audio with video
- **Input:** Video URL + Audio URLs (audio already exists)
- **Use Case:** When someone already has dubbed audio files
- **Status:** Working, keep as-is

#### **2. Full Dubbing API (New ⚠️)**
```
POST /api/dub-jobs
```
- **Purpose:** Full pipeline (extract → transcribe → translate → TTS → merge)
- **Input:** Video URL + source language + target languages
- **Output:** Dubbed videos in multiple languages
- **Uses:** Internally calls merge service from Endpoint #1

### How They Work Together

```
POST /api/dub-jobs
    ↓
1. Extract audio from video
2. Transcribe audio → text
3. Translate text to target languages
4. Generate TTS for each language
5. **CALL merge service (reuse existing code)** ✅
6. Upload to R2
7. Send webhook
```

---

## 📦 EXISTING CODE TO REUSE

**DO NOT modify these files (they work!):**

- ✅ `src/services/ffmpegService.js` - Audio/video merge logic
- ✅ `src/services/downloadService.js` - Download files from URLs
- ✅ `src/services/webhookService.js` - Send webhook callbacks
- ✅ `src/routes/testMerge.js` - Test merge endpoints
- ✅ `src/routes/merge.js` - Production merge endpoint (skeleton)
- ✅ `src/middleware/auth.js` - Authentication
- ✅ `src/utils/cleanup.js` - Auto cleanup system
- ✅ `public/test.html` - Test interface
- ✅ `test/fakeWebhookReceiver.js` - Webhook testing

**These will be called internally by the new dubbing pipeline.**

---

## 🚀 IMPLEMENTATION PHASES

---

## PHASE 0: Foundation ✅ COMPLETE

**What's Already Done:**
- ✅ Server setup with Express
- ✅ FFmpeg integration
- ✅ Audio/Video merge service (`ffmpegService.js`)
- ✅ File download service (`downloadService.js`)
- ✅ Test endpoints (`/test/merge-one`, `/test/merge-multiple`)
- ✅ URL-based and upload-based merging
- ✅ Webhook service (skeleton)
- ✅ Cleanup system (delete old files)
- ✅ Auth middleware
- ✅ Docker support
- ✅ HTML test interface

**Status:** ✅ COMPLETE - Don't touch, reuse as-is

---

## PHASE 1: Project Restructuring (1 day) ⚠️

**Goal:** Organize codebase to separate Merge-Only and Full Dubbing features

### Why Restructure?
- Keep merge-only API isolated and stable
- Clear separation between two different features
- Easier maintenance and testing
- Better code organization

### New Project Structure:

```
Backend/
├── src/
│   ├── merge-only/              (NEW FOLDER - Existing merge features)
│   │   ├── routes/
│   │   │   ├── testMerge.js     (MOVE from src/routes/)
│   │   │   └── merge.js         (MOVE from src/routes/)
│   │   ├── services/
│   │   │   ├── ffmpegService.js (MOVE from src/services/)
│   │   │   ├── downloadService.js (MOVE from src/services/)
│   │   │   └── webhookService.js (MOVE from src/services/)
│   │   └── middleware/
│   │       └── auth.js          (MOVE from src/middleware/)
│   │
│   ├── dubbing-pipeline/        (NEW FOLDER - Full dubbing features)
│   │   ├── routes/
│   │   │   └── dubJobs.js       (NEW - Phase 7)
│   │   ├── services/
│   │   │   ├── audioExtractionService.js   (NEW - Phase 2)
│   │   │   ├── transcriptionService.js     (NEW - Phase 3)
│   │   │   ├── translationService.js       (NEW - Phase 4)
│   │   │   ├── ttsService.js               (NEW - Phase 5)
│   │   │   ├── r2Service.js                (NEW - Phase 6)
│   │   │   └── jobQueue.js                 (NEW - Phase 7)
│   │   └── middleware/
│   │       └── auth.js          (SYMLINK or shared)
│   │
│   ├── shared/                  (NEW FOLDER - Shared utilities)
│   │   └── utils/
│   │       └── cleanup.js       (MOVE from src/utils/)
│   │
│   └── config/                  (NEW FOLDER - Shared config)
│       └── voices.js            (NEW - voice mapping)
│
├── public/
│   ├── output/
│   └── test.html
│
├── temp/
├── storage/
├── test/
│   └── fakeWebhookReceiver.js
│
├── server.js                    (UPDATE - route imports)
├── package.json
├── .env
├── .env.example
└── plan.md
```

### Tasks:

#### **1. Create New Folder Structure:**
```bash
mkdir src/merge-only
mkdir src/merge-only/routes
mkdir src/merge-only/services
mkdir src/merge-only/middleware

mkdir src/dubbing-pipeline
mkdir src/dubbing-pipeline/routes
mkdir src/dubbing-pipeline/services
mkdir src/dubbing-pipeline/middleware

mkdir src/shared
mkdir src/shared/utils

mkdir src/config
```

#### **2. Move Merge-Only Files:**
```bash
# Routes
move src/routes/testMerge.js → src/merge-only/routes/testMerge.js
move src/routes/merge.js → src/merge-only/routes/merge.js
move src/routes/health.js → src/merge-only/routes/health.js

# Services
move src/services/ffmpegService.js → src/merge-only/services/ffmpegService.js
move src/services/downloadService.js → src/merge-only/services/downloadService.js
move src/services/webhookService.js → src/merge-only/services/webhookService.js
move src/services/storageService.js → src/merge-only/services/storageService.js
move src/services/video.js → src/merge-only/services/video.js

# Middleware
move src/middleware/auth.js → src/merge-only/middleware/auth.js

# Utils
move src/utils/cleanup.js → src/shared/utils/cleanup.js
```

#### **3. Update Import Paths in Moved Files:**

Update all `require()` statements to use new paths:

**Before:**
```javascript
const { mergeAudioVideo } = require('../services/ffmpegService');
```

**After:**
```javascript
const { mergeAudioVideo } = require('../merge-only/services/ffmpegService');
```

#### **4. Update `server.js`:**

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const app = express();

require('dotenv').config();

// Import cleanup utility
const { startAutoCleanup } = require('./src/shared/utils/cleanup');

// Configuration
const PORT = process.env.PORT || 8080;
const AUTO_CLEANUP = process.env.AUTO_CLEANUP !== 'false';

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// ===== MERGE-ONLY ROUTES =====
const healthRoute = require('./src/merge-only/routes/health');
const mergeRoute = require('./src/merge-only/routes/merge');
const testMergeRoute = require('./src/merge-only/routes/testMerge');

app.use('/health', healthRoute);
app.use('/merge', mergeRoute);
app.use('/test', testMergeRoute);

// ===== DUBBING PIPELINE ROUTES (Future) =====
// const dubJobsRoute = require('./src/dubbing-pipeline/routes/dubJobs');
// app.use('/api/dub-jobs', dubJobsRoute);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Dubbing Merge Server running on port ${PORT}`);
  console.log(`📍 Merge-only API: http://localhost:${PORT}/test/merge-one`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  
  if (AUTO_CLEANUP) {
    startAutoCleanup();
  }
});
```

#### **5. Create Voice Configuration File:**

```javascript
// src/config/voices.js
/**
 * Best graded voices per language for Kokoro TTS
 * Based on VOICES.md from hexgrad/Kokoro-82M
 */

const BEST_VOICES_PER_LANGUAGE = {
  // English
  'en': 'af_heart',        // Grade A (best overall)
  'en-US': 'af_heart',     // Grade A
  'en-GB': 'bf_emma',      // Grade B-
  
  // Other languages
  'es': 'ef_dora',         // Spanish Female
  'fr': 'ff_siwis',        // Grade B- (only French voice)
  'it': 'if_sara',         // Grade C (Female)
  'ja': 'jf_alpha',        // Grade C+ (best Japanese)
  'zh': 'zf_xiaobei',      // Grade D
  'hi': 'hf_alpha',        // Grade C
  'pt': 'pf_dora',         // Portuguese
  'pt-BR': 'pf_dora'       // Brazilian Portuguese
};

const DEFAULT_VOICE = 'af_heart'; // Grade A - fallback

const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'it', 'pt', 'hi', 'ja', 'zh'
];

module.exports = {
  BEST_VOICES_PER_LANGUAGE,
  DEFAULT_VOICE,
  SUPPORTED_LANGUAGES
};
```

#### **6. Test Everything Still Works:**

```bash
# Start server
npm start

# Test endpoints still work
curl http://localhost:8080/health
# Test merge endpoint (use Postman or test.html)
```

#### **7. Update `.gitignore` (if needed):**

```
# Keep these ignored
node_modules/
.env
temp/*
!temp/.gitkeep
public/output/*
!public/output/.gitkeep
storage/*
!storage/.gitkeep
```

#### **8. Commit Changes:**

```bash
git add .
git commit -m "Phase 1: Restructure project - separate merge-only and dubbing-pipeline"
git push origin main
```

### Deliverable:
- ✅ Clean folder structure
- ✅ Merge-only features in `src/merge-only/`
- ✅ Dubbing pipeline folder ready in `src/dubbing-pipeline/`
- ✅ Shared utilities in `src/shared/`
- ✅ All existing functionality still works
- ✅ Server starts without errors

### Testing Checklist:
- [ ] Server starts: `npm start`
- [ ] Health check works: `GET /health`
- [ ] Test merge works: `POST /test/merge-one`
- [ ] Test multiple merge works: `POST /test/merge-multiple`
- [ ] HTML test page loads: `http://localhost:8080/test.html`
- [ ] File uploads work
- [ ] URL-based merge works
- [ ] No import errors in console

### Files Modified:
- `server.js` (update imports)
- All files in `src/merge-only/` (update relative imports)
- `.gitignore` (verify)

### New Files Created:
- `src/config/voices.js`

### Next Phase:
After restructuring, **Phase 2** will be Audio Extraction - adding first service to `src/dubbing-pipeline/services/`

---

**Estimated Time:** 1 day (mostly moving files and updating imports)

---

## PHASE 2: Audio Extraction (1 day) ⚠️

**Goal:** Extract audio from video file using FFmpeg

### Tasks:
1. Create `src/dubbing-pipeline/services/audioExtractionService.js`
2. Implement FFmpeg command:
   ```bash
   ffmpeg -i video.mp4 -vn -ar 16000 -ac 1 -acodec pcm_s16le audio.wav
   ```
   - `-vn` = no video
   - `-ar 16000` = sample rate 16kHz (required by AssemblyAI)
   - `-ac 1` = mono channel
   - `-acodec pcm_s16le` = PCM format (uncompressed)

3. Test with sample videos (30s, 5min)

### Deliverable:
```javascript
// src/dubbing-pipeline/services/audioExtractionService.js
async function extractAudio(videoPath, outputPath) {
  // Returns: path to extracted audio.wav
}
```

### Testing:
- Test with short video (30 seconds)
- Test with longer video (5 minutes)
- Verify audio.wav is valid and playable

### Files to Create:
- `src/dubbing-pipeline/services/audioExtractionService.js` (NEW)

### Dependencies:
- FFmpeg (already installed ✅)

**Goal:** Convert audio to text using AssemblyAI

### Setup:
1. Sign up for AssemblyAI: https://www.assemblyai.com/
2. Free tier: 3 hours of audio/month
3. Get API key

### Tasks:
1. Create `src/services/transcriptionService.js`
2. Upload audio file to AssemblyAI
3. Create transcription job
4. Poll for completion (async processing)
5. Retrieve full transcript with timestamps

### API Flow:
```javascript
// 1. Upload audio
POST https://api.assemblyai.com/v2/upload
Body: <audio file>
Returns: { upload_url }

// 2. Create transcript
POST https://api.assemblyai.com/v2/transcript
Body: { audio_url, language_code }
Returns: { id, status: "queued" }

// 3. Poll for completion
GET https://api.assemblyai.com/v2/transcript/{id}
Returns: { status: "completed", text: "..." }
```

### Deliverable:
```javascript
// src/services/transcriptionService.js
async function transcribeAudio(audioPath, language) {
  // Returns: { text, segments: [{text, start, end}] }
}
```

### Testing:
- Test with 30-second English audio
- Test with 5-minute audio
- Verify transcript accuracy

### Files to Create:
- `src/services/transcriptionService.js` (NEW)

### Environment Variables:
```
ASSEMBLYAI_API_KEY=your-key-here
```

### Dependencies to Install:
```bash
npm install axios
```

---

## PHASE 3: Translation Integration (2 days) ⚠️

**Goal:** Translate transcript text to target languages

### Translation Service Options:

#### **Option A: Google Translate API** (Recommended)
- Cost: $20 per 1M characters
- Quality: Excellent
- Setup: https://cloud.google.com/translate/docs

#### **Option B: DeepL API** (Best Quality)
- Free tier: 500k characters/month
- Quality: Best available
- Setup: https://www.deepl.com/pro-api

#### **Option C: LibreTranslate** (Free)
- Self-hosted or free API
- Quality: Good
- Setup: https://libretranslate.com/

### Tasks:
1. Choose translation service (recommend DeepL free tier)
2. Create `src/services/translationService.js`
3. Translate full transcript text
4. Preserve paragraph/sentence structure
5. Handle batch translation for multiple languages

### Deliverable:
```javascript
// src/services/translationService.js
async function translateText(text, sourceLang, targetLang) {
  // Returns: translated text
}

async function batchTranslate(text, sourceLang, targetLangs) {
  // Returns: { 'es': '...', 'fr': '...', 'it': '...' }
}
```

### Testing:
- Test English → Spanish
- Test English → French, Italian, Portuguese
- Verify translation quality
- Test with long text (5000+ characters)

### Files to Create:
- `src/services/translationService.js` (NEW)

### Environment Variables:
```
TRANSLATION_SERVICE=deepl
DEEPL_API_KEY=your-key-here
```

### Dependencies to Install:
```bash
npm install deepl-node
# OR
npm install @google-cloud/translate
```

---

## PHASE 4: Text-to-Speech Integration (2 days) ⚠️

**Goal:** Generate speech from translated text using Kokoro TTS

### Setup:
- API Key: Already have (`YOUR_REPLICATE_API_TOKEN`)
- Model: `alphanumericuser/kokoro-82m`

### Voice Selection (Best graded per language):
```javascript
const BEST_VOICES = {
  'en': 'af_heart',     // Grade A (best overall)
  'es': 'ef_dora',      // Spanish female
  'fr': 'ff_siwis',     // Grade B- (only French voice)
  'it': 'if_sara',      // Grade C
  'ja': 'jf_alpha',     // Grade C+
  'zh': 'zf_xiaobei',   // Grade D
  'hi': 'hf_alpha',     // Grade C
  'pt': 'pf_dora'       // Portuguese
};
```

### Tasks:
1. Create `src/services/ttsService.js`
2. Integrate Replicate API
3. Call Kokoro model with text + voice
4. Save generated audio files
5. Handle text chunking (max ~400 tokens per request)

### API Flow:
```javascript
const replicate = await Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const output = await replicate.run(
  "alphanumericuser/kokoro-82m",
  {
    input: {
      text: "Hello, this is a test",
      voice: "af_heart",
      speed: 1.0
    }
  }
);
// Returns: audio file URL
```

### Deliverable:
```javascript
// src/services/ttsService.js
async function generateSpeech(text, language, voiceId) {
  // Returns: path to generated audio.mp3
}

async function batchGenerateSpeech(translations) {
  // Returns: { 'es': 'audio_es.mp3', 'fr': 'audio_fr.mp3', ... }
}
```

### Testing:
- Test short text (10 words)
- Test medium text (100 words)
- Test long text (500 words)
- Test all supported languages
- Verify audio quality

### Files to Create:
- `src/services/ttsService.js` (NEW)

### Environment Variables (already set):
```
REPLICATE_API_TOKEN=YOUR_REPLICATE_API_TOKEN
KOKORO_MODEL=alphanumericuser/kokoro-82m
```

### Dependencies to Install:
```bash
npm install replicate
```

---

## PHASE 5: Cloudflare R2 Storage (2 days) ⚠️

**Goal:** Upload files to cloud storage for permanent access

### Setup:
1. Sign up for Cloudflare R2: https://www.cloudflare.com/products/r2/
2. Free tier: 10GB storage, 1M Class A operations/month
3. Create bucket
4. Get access keys

### File Organization:
```
jobs/{jobId}/
  ├── original/
  │   ├── video.mp4
  │   └── audio.wav
  ├── transcripts/
  │   ├── source.json
  │   ├── es.json
  │   ├── fr.json
  │   └── it.json
  ├── audio/
  │   ├── es.mp3
  │   ├── fr.mp3
  │   └── it.mp3
  └── output/
      ├── es.mp4
      ├── fr.mp4
      └── it.mp4
```

### Tasks:
1. Create `src/services/r2Service.js`
2. Configure AWS S3 SDK (R2 is S3-compatible)
3. Upload files to R2
4. Generate public URLs or signed URLs
5. Handle large file uploads (streaming)

### Deliverable:
```javascript
// src/services/r2Service.js
async function uploadFile(localPath, r2Key) {
  // Returns: public URL
}

async function uploadJobFiles(jobId, files) {
  // Returns: { original: 'url', outputs: { es: 'url', ... } }
}

async function deleteJobFiles(jobId) {
  // Clean up files after X days
}
```

### Testing:
- Upload small file (1MB)
- Upload large file (100MB)
- Get public URL
- Verify file is accessible
- Test deletion

### Files to Create:
- `src/services/r2Service.js` (NEW)

### Environment Variables:
```
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=dubbing-videos
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### Dependencies to Install:
```bash
npm install @aws-sdk/client-s3
npm install @aws-sdk/lib-storage
```

---

## PHASE 6: Job Queue System (2 days) ⚠️

**Goal:** Process jobs asynchronously in background

### Why Queue?
- Jobs can take 5-30 minutes
- Can't block HTTP request for that long
- Need to process multiple jobs simultaneously
- Retry failed jobs

### Setup:
1. Install Redis (for job queue)
   - Option A: Local Redis: `docker run -d -p 6379:6379 redis`
   - Option B: Free Redis Cloud: https://redis.com/try-free/
2. Install Bull queue library

### Tasks:
1. Create `src/services/jobQueue.js`
2. Define job processor function
3. Add job to queue when request arrives
4. Return 202 Accepted immediately
5. Process job in background
6. Track job status (pending → processing → completed/failed)

### Queue Flow:
```
POST /api/dub-jobs
    ↓
Add job to queue → Return 202 Accepted { jobId }
    ↓
Background worker picks up job
    ↓
Process: Extract → Transcribe → Translate → TTS → Merge
    ↓
Upload to R2 → Call webhook
```

### Deliverable:
```javascript
// src/services/jobQueue.js
const Queue = require('bull');

const dubbingQueue = new Queue('dubbing-jobs', {
  redis: { host: 'localhost', port: 6379 }
});

// Add job
async function addDubbingJob(jobData) {
  const job = await dubbingQueue.add(jobData);
  return job.id;
}

// Process jobs
dubbingQueue.process(async (job) => {
  // Full pipeline here
  await processDubbingJob(job.data);
});
```

### Testing:
- Submit 1 job, verify it processes
- Submit 3 jobs, verify they process sequentially
- Test job failure and retry
- Check job status

### Files to Create:
- `src/services/jobQueue.js` (NEW)

### Environment Variables:
```
REDIS_URL=redis://localhost:6379
# OR
REDIS_URL=redis://:password@redis-cloud-url:port
```

### Dependencies to Install:
```bash
npm install bull redis
```

---

## PHASE 7: Production Endpoint (3 days) ⚠️

**Goal:** Full `/api/dub-jobs` endpoint with complete pipeline

### Tasks:
1. Create `src/routes/dubJobs.js`
2. Implement request validation
3. Create job processor that orchestrates all services:
   - Download video (reuse `downloadService.js`)
   - Extract audio (Phase 1)
   - Transcribe (Phase 2)
   - Translate (Phase 3)
   - Generate TTS (Phase 4)
   - **Merge audio+video (reuse `ffmpegService.js`)** ✅
   - Upload to R2 (Phase 5)
   - Call webhook (reuse `webhookService.js`)
4. Handle errors and partial failures
5. Update job status at each step

### API Contract:

#### Request:
```json
POST /api/dub-jobs
Headers:
  x-dubbing-secret: <secret>
  Content-Type: application/json

Body:
{
  "videoUrl": "https://example.com/video.mp4",
  "sourceLanguage": "en",
  "targetLanguages": ["es", "fr", "it"]
}
```

#### Response (Immediate):
```json
202 Accepted
{
  "jobId": "job_abc123",
  "status": "queued",
  "message": "Job accepted and queued for processing"
}
```

#### Webhook Callback (When Complete):
```json
POST <webhookUrl>
Headers:
  x-dubbing-secret: <secret>

Body:
{
  "jobId": "job_abc123",
  "status": "completed",
  "results": {
    "es": "https://r2.dev/jobs/abc123/output/es.mp4",
    "fr": "https://r2.dev/jobs/abc123/output/fr.mp4",
    "it": "https://r2.dev/jobs/abc123/output/it.mp4"
  },
  "metadata": {
    "videoDuration": 120.5,
    "processedAt": "2026-07-07T10:30:00Z",
    "processingTime": 345000
  }
}
```

### Pipeline Implementation:

```javascript
// src/routes/dubJobs.js
async function processDubbingJob(jobData) {
  const { jobId, videoUrl, sourceLanguage, targetLanguages } = jobData;
  
  try {
    // 1. Download video
    const videoPath = await downloadVideo(videoUrl, jobId);
    await uploadToR2(videoPath, `jobs/${jobId}/original/video.mp4`);
    
    // 2. Extract audio
    const audioPath = await extractAudio(videoPath);
    await uploadToR2(audioPath, `jobs/${jobId}/original/audio.wav`);
    
    // 3. Transcribe
    const transcript = await transcribeAudio(audioPath, sourceLanguage);
    await uploadToR2(transcript, `jobs/${jobId}/transcripts/source.json`);
    
    // 4. Translate to all target languages
    const translations = await batchTranslate(
      transcript.text, 
      sourceLanguage, 
      targetLanguages
    );
    
    // 5. Generate TTS for each language
    const audioFiles = {};
    for (const [lang, text] of Object.entries(translations)) {
      const voice = BEST_VOICES[lang];
      const audioPath = await generateSpeech(text, lang, voice);
      audioFiles[lang] = audioPath;
      await uploadToR2(audioPath, `jobs/${jobId}/audio/${lang}.mp3`);
    }
    
    // 6. MERGE audio with video (REUSE existing code!)
    const { mergeAudioVideo } = require('../services/ffmpegService');
    const results = {};
    
    for (const [lang, audioPath] of Object.entries(audioFiles)) {
      const outputPath = path.join(
        process.cwd(), 
        'public', 
        'output', 
        `${jobId}_${lang}.mp4`
      );
      
      // This is YOUR merge function! ✅
      await mergeAudioVideo(videoPath, audioPath, outputPath);
      
      // Upload to R2
      const r2Url = await uploadToR2(
        outputPath, 
        `jobs/${jobId}/output/${lang}.mp4`
      );
      results[lang] = r2Url;
      
      // Clean up local file
      await fs.unlink(outputPath);
    }
    
    // 7. Send webhook (REUSE existing code!)
    const { sendSuccess } = require('../services/webhookService');
    await sendSuccess(webhookUrl, jobId, projectId, results);
    
    // 8. Cleanup temp files
    await cleanupTempFiles(jobId);
    
    return { status: 'completed', results };
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    
    // Send failure webhook
    const { sendFailure } = require('../services/webhookService');
    await sendFailure(webhookUrl, jobId, projectId, error.message);
    
    throw error;
  }
}
```

### Error Handling:

```javascript
// Partial failure example
if (someLanguagesFailed) {
  const { sendPartial } = require('../services/webhookService');
  await sendPartial(webhookUrl, jobId, projectId, {
    'es': 'https://r2.dev/es.mp4',  // success
    'fr': 'https://r2.dev/fr.mp4',  // success
    'it': { error: 'TTS generation failed: timeout' }  // failure
  });
}
```

### Deliverable:
- Working end-to-end pipeline
- Proper error handling
- Webhook notifications
- Job status tracking

### Testing:
- Test with 30-second video, 1 language
- Test with 5-minute video, 3 languages
- Test error scenarios (bad video URL, transcription timeout, etc.)
- Test partial failure (1 language succeeds, 1 fails)
- Test with fake webhook receiver

### Files to Create:
- `src/routes/dubJobs.js` (NEW)
- Update `server.js` to add route

### Files to Reuse:
- ✅ `src/services/ffmpegService.js` (merge logic)
- ✅ `src/services/downloadService.js` (download files)
- ✅ `src/services/webhookService.js` (send webhooks)

---

## PHASE 8: Testing & Polish (2 days) ⚠️

**Goal:** Thorough testing and bug fixes

### Testing Checklist:

#### **Functional Testing:**
- [ ] Test with various video lengths:
  - [ ] 30 seconds
  - [ ] 5 minutes
  - [ ] 30 minutes
  - [ ] 1 hour
- [ ] Test with all supported languages:
  - [ ] English → Spanish
  - [ ] English → French
  - [ ] English → Italian
  - [ ] English → Portuguese
  - [ ] English → Japanese
  - [ ] English → Chinese
  - [ ] English → Hindi
- [ ] Test single language dubbing
- [ ] Test multiple languages (3-5) simultaneously
- [ ] Test with different video formats (mp4, mov, avi)
- [ ] Test with different video resolutions (720p, 1080p, 4K)

#### **Error Scenarios:**
- [ ] Invalid video URL (404)
- [ ] Corrupted video file
- [ ] Unsupported video format
- [ ] Very short video (< 5 seconds)
- [ ] Very long video (> 1 hour)
- [ ] Transcription API timeout
- [ ] Translation API failure
- [ ] TTS API failure
- [ ] R2 upload failure
- [ ] Webhook endpoint down
- [ ] Invalid language code

#### **Performance Testing:**
- [ ] Measure processing time per video length
- [ ] Test with 5 jobs queued simultaneously
- [ ] Verify jobs don't interfere with each other
- [ ] Check memory usage during processing
- [ ] Monitor temp file cleanup

#### **Integration Testing:**
- [ ] Test with real webhook receiver (fake or Next.js app)
- [ ] Verify R2 URLs are accessible
- [ ] Test merged video quality
- [ ] Verify audio sync with video
- [ ] Check all API keys work in production

### Polish Tasks:
1. Add detailed logging at each step
2. Improve error messages
3. Add progress tracking (optional)
4. Update `test.html` to test `/api/dub-jobs`
5. Document API in `README.md`
6. Create example request/response in docs

### Deliverable:
- Stable, tested system
- No critical bugs
- Good error handling
- Updated documentation

### Files to Edit:
- `public/test.html` - add dubbing endpoint test
- `README.md` - document `/api/dub-jobs` endpoint
- `plan.md` - mark phases complete

---

## PHASE 9: Railway Deployment (1 day) ⚠️

**Goal:** Deploy to production on Railway

### Pre-Deployment Checklist:
- [ ] All code committed to GitHub
- [ ] All tests passing locally
- [ ] `.env` file documented in `.env.example`
- [ ] No secrets committed to git
- [ ] README.md updated
- [ ] Docker support verified (optional)

### Deployment Steps:

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Full dubbing pipeline complete"
   git push origin main
   ```

2. **Connect to Railway:**
   - Go to https://railway.app/
   - New Project → Deploy from GitHub
   - Select your repository
   - Wait for initial deploy

3. **Add Environment Variables on Railway:**
   ```
   PORT=8080
   NODE_ENV=production
   CUSTOM_DUBBING_SECRET=<generate with: openssl rand -base64 32>
   
   # Replicate
   REPLICATE_API_TOKEN=YOUR_REPLICATE_API_TOKEN
   KOKORO_MODEL=alphanumericuser/kokoro-82m
   
   # AssemblyAI
   ASSEMBLYAI_API_KEY=<your-key>
   
   # Translation (DeepL)
   DEEPL_API_KEY=<your-key>
   
   # Cloudflare R2
   R2_ACCOUNT_ID=<your-account-id>
   R2_ACCESS_KEY_ID=<your-access-key>
   R2_SECRET_ACCESS_KEY=<your-secret-key>
   R2_BUCKET_NAME=dubbing-videos
   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
   
   # Redis (Railway provides this automatically)
   REDIS_URL=<auto-provided>
   
   # Server URL
   SERVER_URL=https://your-app.railway.app
   ```

4. **Add Redis Service:**
   - Railway Dashboard → New Service
   - Select Redis
   - Link to your app
   - Redis URL auto-configured

5. **Verify Deployment:**
   - Check health endpoint: `https://your-app.railway.app/health`
   - Test merge endpoint: `POST /test/merge-one`
   - Test dubbing endpoint: `POST /api/dub-jobs`

6. **Update Next.js App (Client Side):**
   - Update environment variable on Vercel:
     ```
     CUSTOM_DUBBING_SERVER_URL=https://your-app.railway.app/api/dub-jobs
     ```

7. **Test End-to-End:**
   - Submit real job from Next.js app
   - Verify webhook callback works
   - Check R2 files are uploaded
   - Verify merged videos are downloadable

### Monitoring:
- Check Railway logs for errors
- Monitor API usage (AssemblyAI, Replicate, DeepL)
- Check R2 storage usage
- Monitor Redis memory

### Deliverable:
- Live production server
- All endpoints working
- Next.js app can submit jobs
- Webhooks working

---

## 📊 TIMELINE & STATUS TRACKER

| Phase | Task | Duration | Status | Start Date | End Date |
|-------|------|----------|--------|------------|----------|
| 0 | Foundation (Merge API) | - | ✅ COMPLETE | - | 2026-07-06 |
| 1 | Project Restructuring | 1 day | ⚠️ TODO | | |
| 2 | Audio Extraction | 1 day | ⚠️ TODO | | |
| 3 | Transcription (AssemblyAI) | 2 days | ⚠️ TODO | | |
| 4 | Translation | 2 days | ⚠️ TODO | | |
| 5 | Text-to-Speech (Kokoro) | 2 days | ⚠️ TODO | | |
| 6 | R2 Storage | 2 days | ⚠️ TODO | | |
| 7 | Job Queue | 2 days | ⚠️ TODO | | |
| 8 | Production Endpoint | 3 days | ⚠️ TODO | | |
| 9 | Testing & Polish | 2 days | ⚠️ TODO | | |
| 10 | Railway Deployment | 1 day | ⚠️ TODO | | |
| **TOTAL** | | **~18 days** | | | |

---

## 📁 NEW FILES TO CREATE

```
Backend/
├── src/
│   ├── routes/
│   │   └── dubJobs.js              (NEW - Phase 7)
│   │
│   └── services/
│       ├── audioExtractionService.js   (NEW - Phase 1)
│       ├── transcriptionService.js     (NEW - Phase 2)
│       ├── translationService.js       (NEW - Phase 3)
│       ├── ttsService.js               (NEW - Phase 4)
│       ├── r2Service.js                (NEW - Phase 5)
│       └── jobQueue.js                 (NEW - Phase 6)
│
└── plan.md                         (THIS FILE)
```

---

## 🔧 DEPENDENCIES TO INSTALL

```bash
# Phase 2: Transcription
npm install axios

# Phase 3: Translation
npm install deepl-node
# OR
npm install @google-cloud/translate

# Phase 4: TTS
npm install replicate

# Phase 5: R2 Storage
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage

# Phase 6: Job Queue
npm install bull redis
```

---

## 🎯 NEXT STEPS

1. **Start with Phase 1** (Audio Extraction) - quick win, 1 day
2. Work sequentially through phases 2-7
3. Test thoroughly in Phase 8
4. Deploy to Railway in Phase 9

**Ready to start Phase 1?** 🚀

---

*Last Updated: 2026-07-07*
*Status: Planning Complete, Implementation Ready*
