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
    "targetLanguages": ["en", "fr"]
  }
  ```
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
  * `video` (File binary, max 500MB)
  * `sourceLanguage` (String, e.g. `"es"`)
  * `targetLanguages` (JSON string array, e.g. `["en", "fr"]`)
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
    "status": "processing"
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

---

## Supported Languages

* **Source:** Any major language (AssemblyAI auto-detects)
* **Targets (Kokoro TTS):** `en`, `es`, `fr`, `it`, `pt`, `hi`
