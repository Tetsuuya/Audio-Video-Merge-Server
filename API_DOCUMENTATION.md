# Dubbing Server API Reference

**Base URL:** `https://dubbing-merge-server.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io`

---

## Endpoints

### `GET /health`
No params. Returns server status.

---

### `POST /api/dubbing/async/single`
Submit a dubbing job via video URL.

**Headers:** `Content-Type: application/json`

**Body:**
```json
{
  "videoUrl": "https://...",
  "sourceLanguage": "en",
  "targetLanguages": ["es", "fr"],
  "ttsEngine": "kokoro",
  "voices": { "es": "ef_dora", "fr": "ff_siwis" }
}
```

| Field | Required | Notes |
|---|---|---|
| `videoUrl` | ✅ | YouTube, TikTok, Vimeo, direct `.mp4` |
| `sourceLanguage` | ✅ | Language code of the original video |
| `targetLanguages` | ✅ | Array of target language codes |
| `ttsEngine` | ❌ | `"kokoro"` (default) or `"fish"` |
| `voices` | ❌ | Map of `{ languageCode: voiceId }`. Falls back to default if omitted or invalid |

**Response `202`:**
```json
{
  "success": true,
  "jobId": "job_1784198042093",
  "status": "pending",
  "statusUrl": "/api/dubbing/async/status/job_1784198042093"
}
```

---

### `POST /api/dubbing/async/upload`
Submit a dubbing job via direct file upload.

**Headers:** `Content-Type: multipart/form-data`

| Field | Required | Notes |
|---|---|---|
| `video` | ✅ | Video file. Max 500MB |
| `sourceLanguage` | ✅ | Language code string |
| `targetLanguages` | ✅ | JSON string e.g. `'["es","fr"]'` |
| `ttsEngine` | ❌ | `"kokoro"` or `"fish"` |
| `voices` | ❌ | JSON string e.g. `'{"es":"ef_dora"}'` |

> `targetLanguages` and `voices` must be **JSON-stringified** in form-data.

**Response `202`:** Same as `/async/single`.

---

### `GET /api/dubbing/async/status/:jobId`
Poll job progress and get results.

No body. Replace `:jobId` with the ID from the submit response.

**Response while processing:**
```json
{
  "jobId": "job_1784198042093",
  "status": "processing",
  "currentStep": "tts_synthesis",
  "steps": [
    { "id": "extract_audio", "status": "completed" },
    { "id": "transcribe",    "status": "completed" },
    { "id": "translate",     "status": "completed" },
    { "id": "tts_synthesis", "status": "in_progress" },
    { "id": "merge_video",   "status": "pending" }
  ]
}
```

**Response when done:**
```json
{
  "jobId": "job_1784198042093",
  "status": "completed",
  "results": {
    "es": {
      "video": "https://pub-....r2.dev/job_1784198042093_es.mp4",
      "transcript": "...",
      "translation": "..."
    }
  },
  "metrics": {
    "total_duration": 91.2,
    "segments_count": 8
  }
}
```

---

### `POST /merge`
Merge pre-dubbed audio onto a video. Results sent to your webhook.

**Headers:**
- `Content-Type: application/json`
- `x-dubbing-secret: <your_secret>`

**Body:**
```json
{
  "jobId": "job_abc123",
  "projectId": "project_xyz",
  "videoUrl": "https://...",
  "audioTracks": [
    { "language": "fr-FR", "audioUrl": "https://..." },
    { "language": "de-DE", "audioUrl": "https://..." }
  ],
  "webhookUrl": "https://your-app.com/webhook"
}
```

| Field | Required |
|---|---|
| `jobId` | ✅ |
| `projectId` | ✅ |
| `videoUrl` | ✅ |
| `audioTracks` | ✅ Array, min 1 item |
| `audioTracks[].language` | ✅ e.g. `"fr-FR"` |
| `audioTracks[].audioUrl` | ✅ `.mp3`, `.wav`, `.m4a` |
| `webhookUrl` | ✅ Your callback endpoint |

**Response `202`:** `{ "jobId": "...", "status": "processing" }`

**Webhook payload on complete:**
```json
{
  "jobId": "...", "projectId": "...", "status": "completed",
  "results": { "fr-FR": "https://.../video-fr.mp4" }
}
```

---

## Supported Languages

`en` `es` `fr` `it` `pt` `ja` `tl` `hi`

---

## Kokoro Voices

Pass voice IDs in the `voices` field: `{ "en": "am_adam", "es": "ef_dora" }`

**English (`en`)**

| Voice ID | Description |
|---|---|
| `af_heart` | Female — Grade A ⭐ default |
| `af_bella` | Female — Grade A |
| `af_nicole` | Female — Grade A- |
| `af_aoede` | Female — Grade A- |
| `am_adam` | Male — Grade A- |
| `am_michael` | Male — Grade A- |
| `bf_emma` | UK Female — Grade B+ |
| `bm_george` | UK Male — Grade B+ |

**Other Languages** (one voice each, used by default)

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

## Fish Audio Voices

Pass in `voices` field: `{ "es": "1", "fr": "2" }`

| Value | Resolves to |
|---|---|
| `"1"` / `"female"` | Female voice for that language |
| `"2"` / `"male"` | Male voice for that language |
| 32-char hex string | Your custom cloned Fish Audio voice |

**Built-in voice IDs (for reference):**

| Language | Female | Male |
|---|---|---|
| `en` | `b545c585f631496c914815291da4e893` | `d8a1340984ee4b63ad1ffae27a6a4339` |
| `es` | `87603dd57ecb417e8c57fd4362af1cee` | `8d2c17a9b26d4d83888ea67a1ee565b2` |
| `fr` | `656cde69eff3483b933b8d2ffd388c3c` | `3bce5f0710f949888abe982ded1ef731` |
| `it` | `656cde69eff3483b933b8d2ffd388c3c` | `3bce5f0710f949888abe982ded1ef731` |
| `pt` | `302d4d27c9344460a815ee46efdd5cf0` | `0ba1afd27db44eb2b4cb27fd331b93aa` |
| `ja` | `c13253b3e1fa4580b1295ef7c7e96c41` | `45c5d3723c9c42f598e4776dcfd5f02d` |
| `tl` | `701712d9d2194ebd8c0ea782907ceb38` | `1c25b1a3f43546a5bc4e1568e1ed597e` |
| `hi` | `6904263ba877477fa4ac4a58830126a1` | `b422631422de4186855e9bb1d285a5bd` |
