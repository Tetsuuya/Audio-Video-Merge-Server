# Audio-Video Merge Server - API Documentation

This server provides the backend APIs for the automated video dubbing pipeline (Extract Audio → Transcribe → Translate → TTS → Merge).

**Production Base URL:** `https://dubbing-merge-server.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io`

---

## Endpoints

### 1. Health Check
Checks if the server is active.
* **Method:** `GET`
* **Path:** `/health`
* **Response (200 OK):**
  ```json
  {
    "status": "ok",
    "service": "dubbing-merge-server",
    "timestamp": "2026-07-16T10:27:17.366Z"
  }
  ```

---

### 2. Submit Dubbing Job (Via Video URL)
Queues a dubbing job using a publicly accessible video URL. Returns a `jobId` immediately.
* **Method:** `POST`
* **Path:** `/api/dubbing/async/single`
* **Content-Type:** `application/json`
* **Request Body:**
  ```json
  {
    "videoUrl": "https://example.com/video.mp4",
    "sourceLanguage": "en",
    "targetLanguages": ["es", "fr", "pt", "ja", "tl"],
    "ttsEngine": "kokoro",
    "voices": {
      "en": "am_adam",
      "es": "ef_dora",
      "fr": "ff_siwis",
      "pt": "pf_dora",
      "ja": "jf_alpha",
      "tl": "1"
    }
  }
  ```

| Field | Type | Required | Description |
|---|---|---|---|
| `videoUrl` | string | Yes | Publicly accessible URL to video file (YouTube, TikTok, Vimeo, Twitter, direct .mp4) |
| `sourceLanguage` | string | Yes | Language code of the original video (e.g. `"en"`, `"es"`) |
| `targetLanguages` | string[] | Yes | Target language codes to dub into |
| `ttsEngine` | string | No | `"kokoro"` (default) or `"fish"` |
| `voices` | object | No | Per-language voice selection map (e.g. `{"en": "am_adam", "es": "ef_dora"}`) |
| `fishVoiceId` | string | No | Legacy global Fish Audio voice ID override |
* **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "jobId": "job_1784198042093",
    "status": "pending",
    "message": "Job queued for processing",
    "statusUrl": "/api/dubbing/async/status/job_1784198042093",
    "estimatedTime": "30-60s"
  }
  ```

---

### 3. Submit Dubbing Job (Via File Upload)
Queues a dubbing job by uploading a video file directly to the server. Returns a `jobId` immediately.
* **Method:** `POST`
* **Path:** `/api/dubbing/async/upload`
* **Content-Type:** `multipart/form-data`
* **Form Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `video` | File | Yes | Video file binary (max 500MB) |
| `sourceLanguage` | string | Yes | Language code of the original video |
| `targetLanguages` | string | Yes | JSON string array e.g. `["en", "fr", "pt"]` |
| `ttsEngine` | string | No | `"kokoro"` (default) or `"fish"` |
| `voices` | string | No | JSON string object e.g. `'{"es": "ef_dora", "fr": "ff_siwis"}'` |
| `fishVoiceId` | string | No | Fish Audio voice model ID |
* **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "jobId": "job_1784198042093",
    "status": "pending",
    "message": "Job queued for processing",
    "statusUrl": "/api/dubbing/async/status/job_1784198042093",
    "estimatedTime": "30-60s"
  }
  ```

---

### 4. Check Job Status (Polling & Timeline Stepper)
Polls the progress, granular pipeline step status, and results of a queued job.
* **Method:** `GET`
* **Path:** `/api/dubbing/async/status/:jobId`
* **Response (When Pending/Processing):**
  ```json
  {
    "success": true,
    "jobId": "job_1784198042093",
    "status": "processing",
    "currentStep": "tts_synthesis",
    "currentLanguage": "es",
    "sourceLanguage": "en",
    "targetLanguages": ["es", "fr"],
    "steps": [
      { "id": "extract_audio", "label": "Extract audio", "status": "completed" },
      { "id": "transcribe", "label": "Transcribe", "status": "completed" },
      { "id": "translate", "label": "Translate", "status": "completed" },
      { "id": "tts_synthesis", "label": "TTS synthesis", "status": "in_progress", "currentLanguage": "es" },
      { "id": "merge_video", "label": "Merge video", "status": "pending" }
    ],
    "createdAt": { "_seconds": 1784198043, "_nanoseconds": 29000000 },
    "updatedAt": { "_seconds": 1784198080, "_nanoseconds": 112000000 }
  }
  ```
* **Response (When Completed):**
  ```json
  {
    "success": true,
    "jobId": "job_1784198042093",
    "status": "completed",
    "currentStep": "completed",
    "currentLanguage": null,
    "sourceLanguage": "en",
    "targetLanguages": ["es"],
    "steps": [
      { "id": "extract_audio", "label": "Extract audio", "status": "completed" },
      { "id": "transcribe", "label": "Transcribe", "status": "completed" },
      { "id": "translate", "label": "Translate", "status": "completed" },
      { "id": "tts_synthesis", "label": "TTS synthesis", "status": "completed" },
      { "id": "merge_video", "label": "Merge video", "status": "completed" }
    ],
    "createdAt": { "_seconds": 1784198043, "_nanoseconds": 29000000 },
    "updatedAt": { "_seconds": 1784198140, "_nanoseconds": 398000000 },
    "completedAt": { "_seconds": 1784198140, "_nanoseconds": 398000000 },
    "results": {
      "es": {
        "success": true,
        "transcript": "Hello, how are you?...",
        "translation": "Hola, ¿cómo estás?...",
        "video": "https://pub-2cef9c5568494521818fd27b425ae677.r2.dev/job_1784198042093_es.mp4"
      }
    },
    "metrics": {
      "total_duration": 91.2,
      "extraction_duration": 1.5,
      "transcription_duration": 14.2,
      "translation_duration": 0.8,
      "tts_duration": 60.5,
      "merge_duration": 1.2,
      "upload_duration": 3.0,
      "segments_count": 8,
      "languages_processed": 1
    }
  }
  ```

---

## Supported Languages & Voice Selection Guide

### Supported Target Languages
* `en` (English)
* `es` (Spanish)
* `fr` (French)
* `it` (Italian)
* `pt` (Portuguese)
* `ja` (Japanese)
* `tl` / `fil` (Tagalog / Filipino)
* `hi` (Hindi)

---

### Voice Selection & Smart Fallback Rules

If no voice ID is provided or if an invalid voice ID (e.g. `"10"` or `"id5"`) is sent, the server **automatically falls back to Voice #1 (Female)** for that target language without failing the job.

#### 1. Kokoro TTS Engine (`"ttsEngine": "kokoro"`)

| Target Language | Voice Choices | Voice ID | Description |
|---|---|---|---|
| **English (`en`)** | Grade A Presets | **`af_heart`**<br>**`af_bella`**<br>**`af_nicole`**<br>**`af_aoede`**<br>**`am_adam`**<br>**`am_michael`**<br>**`bf_emma`**<br>**`bm_george`** | Heart (Female, Grade A - Default)<br>Bella (Female, Grade A)<br>Nicole (Female, Grade A-)<br>Aoede (Female, Grade A-)<br>Adam (Male, Grade A-)<br>Michael (Male, Grade A-)<br>Emma (UK Female, Grade B+)<br>George (UK Male, Grade B+) |
| **Spanish (`es`)** | Best Native | **`ef_dora`** | Dora (Female, Grade B+) |
| **French (`fr`)** | Best Native | **`ff_siwis`** | Siwis (Female, Grade B-) |
| **Italian (`it`)** | Best Native | **`if_sara`** | Sara (Female, Grade C+) |
| **Portuguese (`pt`)** | Best Native | **`pf_dora`** | Dora (Female, Grade B+) |
| **Japanese (`ja`)** | Best Native | **`jf_alpha`** | Alpha (Female, Grade B) |
| **Tagalog (`tl`)** | Fallback | **`af_heart`** | Heart (Female, Grade A) |
| **Hindi (`hi`)** | Best Native | **`hf_alpha`** | Alpha (Female, Grade C) |

#### 2. Fish Audio Engine (`"ttsEngine": "fish"`)

For Fish Audio, users can pass:
* `"1"` or `"female"` $\to$ Voice #1 (Female built-in default per language)
* `"2"` or `"male"` $\to$ Voice #2 (Male built-in default per language)
* **Custom 32-character hex Voice ID** $\to$ Any custom or cloned voice from Fish Audio (e.g. `"87603dd57ecb417e8c57fd4362af1cee"`)

---

## Metrics Fields

All duration values are in **seconds** (float).

| Field | Description |
|---|---|
| `total_duration` | Total wall-clock time for the entire job |
| `extraction_duration` | Time to extract audio from video using FFmpeg |
| `transcription_duration` | Time to upload audio and receive transcript from AssemblyAI |
| `translation_duration` | Time to translate all segments via DeepL |
| `tts_duration` | Time to generate all TTS audio clips |
| `merge_duration` | Time to assemble and merge audio+video via FFmpeg |
| `upload_duration` | Time to upload final video to Cloudflare R2 |
| `segments_count` | Number of sentence segments transcript was split into |
| `languages_processed` | Number of target languages processed |
