# Dubbing Server API Reference

**Base URL:** `https://dubbing-merge-server.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io`

---

## Authentication & Security

All mutating endpoints require an API Secret Header for server-to-server security and API abuse prevention:

* **Header Name:** `x-dubbing-secret`
* **Header Value:** `<CUSTOM_DUBBING_SECRET>` (configured in server `.env`)

### Unauthenticated Error Response (`401 Unauthorized`)
If the `x-dubbing-secret` header is missing or invalid, the API returns `HTTP 401`:

```json
{
  "status": "error",
  "message": "Unauthorized: invalid or missing x-dubbing-secret header"
}
```

---

## Endpoints

### `GET /health`
No params. Returns server health status.

---

### `POST /api/dubbing/async/single`
Submit a dubbing job via video URL.

**Headers:** 
* `Content-Type: application/json`
* `x-dubbing-secret: <CUSTOM_DUBBING_SECRET>`

**Body:**
```json
{
  "videoUrl": "https://youtube.com/shorts/...",
  "sourceLanguage": "en",
  "targetLanguages": ["es", "fr"],
  "ttsEngine": "kokoro",
  "voices": { "es": "ef_dora", "fr": "ff_siwis" }
}
```

| Field | Required | Notes |
|---|---|---|
| `videoUrl` | ✅ | YouTube, TikTok, Vimeo, or direct `.mp4` URL |
| `sourceLanguage` | ✅ | Language code of the original video (e.g. `"en"`) |
| `targetLanguages` | ✅ | Array of target language codes e.g. `["es", "fr"]` |
| `ttsEngine` | ❌ | `"kokoro"` (default) or `"fish"` |
| `voices` | ❌ | Map of `{ languageCode: voiceId }`. Falls back to default if omitted |

**Response `202 Accepted`:**
```json
{
  "success": true,
  "jobId": "job_1784622662790",
  "status": "pending",
  "message": "Job queued for processing",
  "statusUrl": "/api/dubbing/async/status/job_1784622662790",
  "estimatedTime": "30-60s"
}
```

---

### `POST /api/dubbing/async/upload`
Submit a dubbing job via direct file upload.

**Headers:** 
* `Content-Type: multipart/form-data`
* `x-dubbing-secret: <CUSTOM_DUBBING_SECRET>`

| Field | Required | Type | Notes |
|---|---|---|---|
| `video` | ✅ | File | Video file upload (Max 500MB) |
| `sourceLanguage` | ✅ | String | Language code string e.g. `"en"` |
| `targetLanguages` | ✅ | String (JSON) | JSON-stringified array e.g. `'["es","fr"]'` |
| `ttsEngine` | ❌ | String | `"kokoro"` or `"fish"` |
| `voices` | ❌ | String (JSON) | JSON-stringified map e.g. `'{"es":"ef_dora"}'` |

> Note: `targetLanguages` and `voices` must be **JSON-stringified** when using `multipart/form-data`.

**Response `202 Accepted`:** Same as `/async/single`.

---

### `GET /api/dubbing/async/status/:jobId`
Poll job progress and get results.

No request body required. Replace `:jobId` with the ID received from job creation.

**Response while processing (`200 OK`):**
```json
{
  "success": true,
  "jobId": "job_1784622662790",
  "status": "processing",
  "currentStep": "tts_synthesis",
  "currentLanguage": "fr",
  "sourceLanguage": "en",
  "targetLanguages": ["fr"],
  "ttsEngine": "fish",
  "steps": [
    { "id": "extract_audio", "status": "completed" },
    { "id": "transcribe",    "status": "completed" },
    { "id": "translate",     "status": "completed" },
    { "id": "tts_synthesis", "status": "in_progress", "currentLanguage": "fr" },
    { "id": "merge_video",   "status": "pending" }
  ]
}
```

**Response when completed (`200 OK`):**
```json
{
  "success": true,
  "jobId": "job_1784622662790",
  "status": "completed",
  "results": {
    "fr": {
      "success": true,
      "transcript": "Hello and welcome to the dubbing test...",
      "translation": "Bonjour, bienvenue à ce test doublage...",
      "video": "https://pub-2cef9c5568494521818fd27b425ae677.r2.dev/job_1784622662790_fr.mp4"
    }
  },
  "metrics": {
    "total_duration": 24.95,
    "segments_count": 2,
    "languages_processed": 1
  }
}
```

---

### `POST /merge`
Merge pre-rendered audio onto a video. Results sent to your webhook.

**Headers:**
* `Content-Type: application/json`
* `x-dubbing-secret: <CUSTOM_DUBBING_SECRET>`

**Body:**
```json
{
  "jobId": "job_abc123",
  "projectId": "project_xyz",
  "videoUrl": "https://example.com/video.mp4",
  "audioTracks": [
    { "language": "fr-FR", "audioUrl": "https://example.com/audio-fr.mp3" },
    { "language": "de-DE", "audioUrl": "https://example.com/audio-de.mp3" }
  ],
  "webhookUrl": "https://your-app.com/api/webhook/merge-complete"
}
```

| Field | Required | Notes |
|---|---|---|
| `jobId` | ✅ | Job identifier string |
| `projectId` | ✅ | Project identifier string |
| `videoUrl` | ✅ | Public URL to input video file |
| `audioTracks` | ✅ | Array of audio track objects (min 1 item) |
| `audioTracks[].language` | ✅ | Language code e.g. `"fr-FR"` |
| `audioTracks[].audioUrl` | ✅ | URL to audio file (`.mp3`, `.wav`, `.m4a`) |
| `webhookUrl` | ✅ | Endpoint URL where completion results will be posted |

**Response `202 Accepted`:** `{ "jobId": "...", "status": "processing" }`

---

## Supported Languages

`en` `es` `fr` `it` `pt` `ja` `tl` `hi`

---

## Kokoro Voices (`ttsEngine: "kokoro"`)

Pass voice IDs in the `voices` field: `{ "en": "am_adam", "es": "ef_dora" }`

**English (`en`)**

| Voice ID | Description |
|---|---|
| `af_heart` | Female — Grade A (Default) |
| `af_bella` | Female — Grade A |
| `af_nicole` | Female — Grade A- |
| `af_aoede` | Female — Grade A- |
| `am_adam` | Male — Grade A- |
| `am_michael` | Male — Grade A- |
| `bf_emma` | UK Female — Grade B+ |
| `bm_george` | UK Male — Grade B+ |

**Other Languages** (Default graded voice per language)

| Language | Voice ID |
|---|---|
| `es` | `ef_dora` |
| `fr` | `ff_siwis` |
| `it` | `if_sara` |
| `pt` | `pf_dora` |
| `ja` | `jf_alpha` |
| `tl` | `af_heart` |
| `hi` | `hf_alpha` |

---

## Fish Audio Voices (`ttsEngine: "fish"`)

Pass voice IDs in `voices` field: `{ "fr": "2", "es": "1" }`

| Value | Description |
|---|---|
| `"1"` / `"female"` | Female default voice for target language |
| `"2"` / `"male"` | Male default voice for target language |
| `32-char hex string` | Custom cloned Fish Audio voice ID |

---

## Frontend Integration Example (Next.js / Fetch)

```javascript
const response = await fetch('https://dubbing-merge-server.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/dubbing/async/single', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-dubbing-secret': process.env.CUSTOM_DUBBING_SECRET // <--- Required Secret Header
  },
  body: JSON.stringify({
    videoUrl: 'https://youtube.com/shorts/...',
    sourceLanguage: 'en',
    targetLanguages: ['fr'],
    ttsEngine: 'fish',
    voices: { 'fr': '2' }
  })
});

const data = await response.json();
console.log('Job queued:', data.jobId);
```
