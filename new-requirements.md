# Project Requirements Comparison

## ORIGINAL REQUIREMENTS (context.md)

### Project: Audio-Video Merge Server (Merge Only)

**Scope:**
- Server receives **already-dubbed audio tracks** and merges them with video
- **NO transcription, translation, or text-to-speech**
- Uses FFmpeg only
- Simple merge operation

**Contract Explicitly States:**
> "This server does **NOT** do transcription, translation, or text-to-speech. The audio files (one per target language) already exist and are provided as input. The only job here is the assembly step: merge audio onto video, store the result, report the download URL back."

**Input:**
```json
POST /merge
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "videoUrl": "https://your-r2-bucket.com/video.mp4",
  "audioTracks": [
    {
      "language": "fr-FR",
      "audioUrl": "https://.../audio-fr.mp3"  // ← Audio already exists
    },
    {
      "language": "de-DE",
      "audioUrl": "https://.../audio-de.mp3"  // ← Audio already exists
    }
  ],
  "webhookUrl": "https://your-app.com/webhook"
}
```

**Output:**
```json
{
  "jobId": "abc123",
  "status": "completed",
  "results": {
    "fr-FR": "https://storage.com/video-fr.mp4",
    "de-DE": "https://storage.com/video-de.mp4"
  }
}
```

**Steps (Original Contract):**
- ✅ Step 0: Local project setup
- ✅ Step 1: Local HTML test page
- ✅ Step 2: Single audio + video merge
- ✅ Step 3: Multiple audio tracks, one video
- ⚠️ Step 4: Local storage / temporary hosting (IN PROGRESS)
- ⚠️ Step 5: Webhook call (NOT STARTED)
- ⚠️ Step 6: Full `/merge` endpoint (NOT STARTED)

**Technology Stack (Original):**
- Node.js + Express ✅
- FFmpeg ✅
- Multer (file uploads) ✅
- Local storage (temp) ✅
- Webhook service ✅
- Docker support ✅

**Estimated Timeline:** 1 week (Steps 0-6)

---

## NEW REQUIREMENTS (Latest Message)

### Project: Full Dubbing Pipeline (A to Z)

**Scope:**
- Server receives video URL and source language
- **Extracts audio** from video
- **Transcribes audio** to text (AssemblyAI)
- **Translates text** to multiple target languages
- **Generates speech** from translated text (Kokoro TTS via Replicate)
- Merges generated audio back to video
- Uploads everything to Cloudflare R2

**Message from Client:**
> "Hello rodriguez, where good advancement yesterday, so i think that you could really make the backend server from A to Z, i wanted to make the task easier but i got a lot of involved work so i will give you all the fonctionalities needed and hope you can do everything, you will have all the techstack from A to Z"

**Input:**
```json
POST /api/dub-jobs
{
  "videoUrl": "https://example.com/source-video.mp4",
  "sourceLanguage": "en",
  "targetLanguages": ["es", "fr", "it"]  // ← Audio does NOT exist yet
}
```

**Processing Flow:**

### Step 1 — Job Creation & Video Ingestion
- Validate `targetLanguages` against Kokoro's supported set: `en, es, fr, it, pt, hi, ja, zh`
- Reject/warn on unsupported languages immediately
- Create job record (`jobId`, status `pending`) in database
- Download video from `videoUrl` (stream to disk, don't buffer in memory)
- Upload original video to R2: `jobs/{jobId}/original/video.mp4`
- Update status → `downloaded`

### Step 2 — Audio Extraction
```bash
ffmpeg -i video.mp4 -vn -ar 16000 -ac 1 -acodec pcm_s16le audio.wav
```
- Upload to R2: `jobs/{jobId}/audio/original.wav`
- Update status → `audio_extracted`

### Step 3 — Transcription (NEW)
- Send audio to **AssemblyAI** API
- Get back full transcript with timestamps
- Save transcript to R2: `jobs/{jobId}/transcripts/source.json`
- Update status → `transcribed`

### Step 4 — Translation (NEW)
- For each target language:
  - Translate transcript text using translation API (Google Translate/DeepL)
  - Preserve timestamps/segmentation
  - Save to R2: `jobs/{jobId}/transcripts/{lang}.json`
- Update status → `translated`

### Step 5 — Text-to-Speech Generation (NEW)
- For each target language:
  - Use **Kokoro TTS** via **Replicate API**
  - Generate audio from translated text
  - Use model: `jaaari/kokoro-82m` (version: `f559560...`)
  - Save to R2: `jobs/{jobId}/audio/{lang}.mp3`
- Update status → `tts_generated`

### Step 6 — Audio/Video Merging
- For each generated audio file:
  - Merge with original video using FFmpeg
  - Use existing merge logic from Steps 2-3
  - Save to R2: `jobs/{jobId}/output/{lang}.mp4`
- Update status → `merged`

### Step 7 — Webhook Callback
- Call `webhookUrl` with results:
```json
{
  "jobId": "abc123",
  "status": "completed",
  "results": {
    "es": "https://r2-bucket.com/jobs/abc123/output/es.mp4",
    "fr": "https://r2-bucket.com/jobs/abc123/output/fr.mp4",
    "it": "https://r2-bucket.com/jobs/abc123/output/it.mp4"
  }
}
```

**Technology Stack (NEW):**
- Node.js + Express ✅ (existing)
- FFmpeg ✅ (existing)
- **AssemblyAI API** ❌ (NEW - transcription)
- **Translation API** ❌ (NEW - Google Translate or DeepL)
- **Replicate API** ❌ (NEW - Kokoro TTS)
- **Cloudflare R2** ❌ (NEW - cloud storage)
- **Database** ❌ (NEW - track job status)
- **Worker Queue** ❌ (NEW - background processing)

**API Keys Provided:**
- Replicate API Key: `YOUR_REPLICATE_API_TOKEN`
- Kokoro Model (Better Version): https://replicate.com/alphanumericuser/kokoro-82m
- ~~Old Model:~~ ~~https://replicate.com/jaaari/kokoro-82m~~ (Replaced with better version)

**Free Tier Services (Client Notes):**
- AssemblyAI: "should have a free test tier, if not you can activate any other solution for now"
- Cloudflare R2: "should have a free tiers too"

**Estimated Timeline:** 4-6 weeks (complete rebuild)

---

## KEY DIFFERENCES

| Aspect | Original (Merge Only) | New (Full Pipeline) |
|--------|----------------------|---------------------|
| **Scope** | Merge existing audio | Extract → Transcribe → Translate → TTS → Merge |
| **Audio Source** | Already exists (provided as URLs) | Generated from scratch |
| **Transcription** | ❌ Not included | ✅ AssemblyAI required |
| **Translation** | ❌ Not included | ✅ Translation API required |
| **Text-to-Speech** | ❌ Not included | ✅ Kokoro TTS required |
| **Storage** | Local disk (temp) | Cloudflare R2 (cloud) |
| **Database** | Not needed | Required (job tracking) |
| **APIs** | 0 external APIs | 3+ external APIs |
| **Complexity** | Low | Very High |
| **Timeline** | 1 week | 4-6 weeks |
| **Cost per Job** | $0 (FFmpeg only) | $0.10-0.50 (API calls) |

---

## CURRENT STATUS

**What's Completed (Original Scope):**
- ✅ Server setup with Express
- ✅ FFmpeg integration and testing
- ✅ Single merge endpoint (`/test/merge-one`)
- ✅ Multiple merge endpoint (`/test/merge-multiple`)
- ✅ File upload support (Multer)
- ✅ URL-based file download
- ✅ Docker support
- ✅ Auto-cleanup system
- ✅ HTML test interface (with upload + URL options)
- ✅ Authentication middleware
- ✅ Webhook service (skeleton)
- ✅ Fake webhook receiver for testing

**What's NOT Done (Original Scope):**
- ⚠️ Step 4: Storage decision (local vs cloud)
- ⚠️ Step 5: Webhook implementation in `/merge` endpoint
- ⚠️ Step 6: Full async `/merge` endpoint with background processing

**What Would Be Required for NEW Scope:**
- ❌ AssemblyAI integration
- ❌ Translation API integration
- ❌ Replicate API + Kokoro TTS integration
- ❌ Cloudflare R2 storage setup
- ❌ Database for job tracking (PostgreSQL/MongoDB)
- ❌ Worker queue system (Bull/BullMQ)
- ❌ Complete architecture redesign
- ❌ 4-6 weeks of development time

---

## QUESTIONS TO CLARIFY WITH CLIENT

1. **Is this replacing the original project, or a separate project?**
   - If replacing: Should we stop current work?
   - If separate: Should we finish Steps 4-6 first?

2. **What's the priority and timeline?**
   - When does the full pipeline need to be ready?
   - Is there a phased approach? (finish merge-only first, then add transcription/TTS)

3. **Why did the scope change?**
   - Original contract explicitly said "NO transcription/translation/TTS"
   - Now requesting full dubbing pipeline
   - What changed?

4. **Budget for API costs?**
   - AssemblyAI: ~$0.03/minute
   - Replicate Kokoro: ~$0.10/request
   - Translation: ~$0.01/1000 chars
   - 10 minutes video × 3 languages = ~$0.50-1.00 per job

5. **Infrastructure requirements?**
   - Database type? (PostgreSQL, MongoDB, etc.)
   - Queue system? (Bull, BullMQ, etc.)
   - R2 bucket already created?

---

## RECOMMENDED PATH FORWARD

### Option A: Finish Original Scope First (Recommended)
1. Complete Steps 4-6 (merge-only server) ← 3 days
2. Deploy to Railway ← 1 day
3. **THEN** discuss adding transcription/TTS features
4. Build new features as Phase 2 ← 3-4 weeks

**Pros:**
- Deliver working merge server quickly
- Less risk of scope creep
- Can use merge server immediately
- Add features incrementally

### Option B: Pivot to Full Pipeline Now
1. Stop current work
2. Start full pipeline from scratch
3. Build all features: transcription → translation → TTS → merge
4. Deploy when complete ← 4-6 weeks

**Pros:**
- One unified system
- No need to refactor later

**Cons:**
- Nothing deployable for 4-6 weeks
- Higher complexity, more risk
- Can't test merge functionality separately

### Option C: Hybrid Approach
1. Finish merge endpoint (Steps 4-6) ← 3 days
2. Deploy merge-only server to Railway ← 1 day
3. **In parallel**, start building transcription/TTS pipeline
4. Integrate both when TTS pipeline is ready ← 3 weeks

**Pros:**
- Working merge server ASAP
- Can start building full pipeline
- Fallback if full pipeline takes longer

---

## DECISION NEEDED

**Before proceeding with ANY code changes, we need client to confirm:**

1. ✅ or ❌ Finish original merge-only server (Steps 4-6)?
2. ✅ or ❌ Start building full dubbing pipeline?
3. What's the deadline/timeline?
4. What's the priority: speed or features?

**DO NOT start coding the new scope until this is clarified.**

---

*Last Updated: 2026-07-07*

---

## ✅ CLIENT DECISIONS (Voice Strategy)

### Voice Selection (Confirmed 2026-07-07)

**Decision Made:**
1. ✅ **Always use same default voice for all videos**
2. ✅ **Use "best graded voice for each proper voice"** - Grade A quality
3. ✅ **One single person by video** - treat entire video as one speaker
4. ✅ **No need to detect** gender or speaker changes

**Model to Use:**
- `alphanumericuser/kokoro-82m` (better version)
- Default Voice: `af_heart` (Overall Grade: **A** - highest quality)

**Voice Quality Grades (from Kokoro documentation):**
| Voice Name | Overall Grade | Notes |
|------------|---------------|-------|
| `af_heart` | **A** | 🏆 Best overall - use this as default |
| `af_bella` | **A-** | Expressive, HH hours training |
| `af_nicole` | **B-** | Good quality |
| `af_aoede` | **C+** | Decent |
| `af_kore` | **C+** | Decent |
| `af_alloy` | **C** | Lower quality |
| `af_jessica` | **D** | Lowest quality |

**Implementation:**
```javascript
const DEFAULT_VOICE = 'af_heart'; // Grade A - use for all languages
const KOKORO_MODEL = 'alphanumericuser/kokoro-82m';
```

**This means:**
- No voice cloning (AI voice replaces original speaker)
- Single high-quality voice (`af_heart`) used for all dubbed videos
- Same voice regardless of video language or content
- No speaker detection or gender analysis needed

---

## OUTSTANDING DECISIONS NEEDED

**Still waiting for client confirmation on:**

1. ❓ **Project Scope Priority**
   - Finish merge-only server (Steps 4-6) first? OR
   - Pivot to full pipeline now?

2. ❓ **Timeline/Deadline**
   - When does full pipeline need to be ready?

---

*Last Updated: 2026-07-07 (Added voice decisions)*
