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
    "sourceLanguage": "es",
    "targetLanguages": ["en", "fr"],
    "ttsEngine": "kokoro",
    "fishVoiceId": null
  }
  ```

| Field | Type | Required | Description |
|---|---|---|---|
| `videoUrl` | string | Yes | Publicly accessible URL to the video file |
| `sourceLanguage` | string | Yes | Language code of the original video (e.g. `"en"`, `"es"`) |
| `targetLanguages` | string[] | Yes | Target language codes to dub into |
| `ttsEngine` | string | No | `"kokoro"` (default) or `"fish"` |
| `fishVoiceId` | string | No | Fish Audio voice model ID. Required when `ttsEngine` is `"fish"` and no default is configured |
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
| `targetLanguages` | string | Yes | JSON string array e.g. `["en", "fr"]` |
| `ttsEngine` | string | No | `"kokoro"` (default) or `"fish"` |
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

### 4. Check Job Status (Polling)
Polls the progress and gets the results of a queued job.
* **Method:** `GET`
* **Path:** `/api/dubbing/async/status/:jobId`
* **Response (When Pending/Processing):**
  ```json
  {
    "success": true,
    "jobId": "job_1784198042093",
    "status": "processing",
    "sourceLanguage": "es",
    "targetLanguages": ["en"],
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
    "sourceLanguage": "es",
    "targetLanguages": ["en"],
    "createdAt": { "_seconds": 1784198043, "_nanoseconds": 29000000 },
    "updatedAt": { "_seconds": 1784198140, "_nanoseconds": 398000000 },
    "completedAt": { "_seconds": 1784198140, "_nanoseconds": 398000000 },
    "results": {
      "en": {
        "success": true,
        "transcript": "Hola, ¿cómo estás?...",
        "translation": "Hello, how are you?...",
        "video": "https://pub-2cef9c5568494521818fd27b425ae677.r2.dev/job_1784198042093_en.mp4"
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
* **Response (When Failed):**
  ```json
  {
    "success": true,
    "jobId": "job_1784198042093",
    "status": "failed",
    "sourceLanguage": "es",
    "targetLanguages": ["en"],
    "createdAt": { "_seconds": 1784198043, "_nanoseconds": 29000000 },
    "updatedAt": { "_seconds": 1784198080, "_nanoseconds": 112000000 },
    "error": "Failed to download video: 404 Not Found"
  }
  ```

---

### Error Responses

**Unsupported target language (400):**
```json
{
  "success": false,
  "error": "Unsupported languages: ja, zh. Supported: en, es, fr, it, pt, hi"
}
```

**Missing required fields (400):**
```json
{
  "success": false,
  "error": "Missing required fields"
}
```

**Job not found (404):**
```json
{
  "success": false,
  "error": "Job not found"
}
```

**Server error (500):**
```json
{
  "success": false,
  "error": "Internal server error message"
}
```

---

## Supported Languages

* **Source:** Pass the language code of the original video explicitly (e.g. `"en"`, `"es"`, `"fr"`). AssemblyAI supports most major languages — see the [AssemblyAI docs](https://www.assemblyai.com/docs) for the full list.
* **Targets (Kokoro TTS):** `en`, `es`, `fr`, `it`, `pt`, `hi`
* **Not supported as targets:** `ja` (Japanese) and `zh` (Mandarin) — the Replicate deployment of Kokoro-82M is missing required tokenizer dependencies for these languages. Passing them will return a 400 error.

---

## Estimated Time

The `estimatedTime` field in the job submission response scales with the number of target languages:

```
estimatedTime = (numberOfLanguages × 30s) to (numberOfLanguages × 60s)
```

Examples:
* 1 language → `"30-60s"`
* 2 languages → `"60-120s"`
* 3 languages → `"90-180s"`

The majority of processing time is spent on TTS generation (~60s per language on average).

---

## Metrics Fields

All duration values are in **seconds** (float).

| Field | Description |
|---|---|
| `total_duration` | Total wall-clock time for the entire job |
| `extraction_duration` | Time to extract audio from the video using FFmpeg |
| `transcription_duration` | Time to upload audio and receive transcript from AssemblyAI |
| `translation_duration` | Time to translate all segments via DeepL |
| `tts_duration` | Time to generate all TTS audio clips via Replicate/Kokoro |
| `merge_duration` | Time to assemble and merge audio+video via FFmpeg |
| `upload_duration` | Time to upload the final video to Cloudflare R2 |
| `segments_count` | Number of sentence segments the transcript was split into |
| `languages_processed` | Number of target languages that were attempted |
