# Dubbing Merge Server

Standalone audio/video merge server that receives video + audio tracks, merges them using ffmpeg, and reports results via webhook.

## Purpose

This server handles the assembly step of the dubbing pipeline:
- Receives video + multiple audio tracks (one per language)
- Merges each audio track with the video using ffmpeg
- Stores the resulting videos
- Calls webhook with download URLs

**Out of scope:** Transcription, translation, text-to-speech (audio arrives pre-generated)

## Architecture

```
[Next.js app] --POST /merge--> [This server]
                                   |
                                   | 1. Download video & audio files
                                   | 2. Merge with ffmpeg (one output per audio)
                                   | 3. Store results
                                   |
[Next.js app] <--POST webhook---- [This server]
      (returns download URLs)
```

## Local Testing Steps

Follow these steps in order (from mission brief):

### Step 0: Project Setup ✓
```bash
npm install
npm start
```
Server should run on http://localhost:8080

### Step 1: Test Page ✓
Open http://localhost:8080/test.html
Click "Check Server Health" - should return 200 OK

### Step 2: Single Audio + Video Merge
Test `/test/merge-one` endpoint with one sample video + one sample audio

### Step 3: Multiple Audio Tracks
Test multiple audio files against the same video

### Step 4: Storage & Download URLs
Verify output videos are accessible via URL (current: local disk)

### Step 5: Webhook Integration
Run fake webhook receiver:
```bash
npm run test:webhook
```
Point merge request to http://localhost:3001/webhook

### Step 6: Full Production Endpoint
Test the real `/merge` endpoint with all features

## API Endpoints

### GET /health
Health check endpoint
- **Auth:** None
- **Response:** `{ status: 'ok', service: '...', timestamp: '...' }`

### POST /merge (Production)
Main merge endpoint
- **Auth:** Required (`x-dubbing-secret` header)
- **Body:**
```json
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "videoUrl": "https://.../video.mp4",
  "audioTracks": [
    { "language": "fr-FR", "audioUrl": "https://.../audio-fr.mp3" },
    { "language": "de-DE", "audioUrl": "https://.../audio-de.mp3" }
  ],
  "webhookUrl": "https://your-app.vercel.app/api/webhook/custom-dubbing"
}
```
- **Response:** `202 Accepted` (processing happens async)

### POST /test/merge-one (Testing)
Test single merge
- **Auth:** None
- **Body:** `{ videoPath, audioPath, outputName }`

### POST /test/merge-multiple (Testing)
Test multiple tracks
- **Auth:** None
- **Body:** `{ videoPath, audioTracks: [...] }`

## Webhook Callbacks

### Success
```json
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "status": "completed",
  "results": {
    "fr-FR": "https://storage.com/video-fr.mp4",
    "de-DE": "https://storage.com/video-de.mp4"
  }
}
```

### Failure
```json
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "status": "failed",
  "error": "Video download failed: 404"
}
```

### Partial Failure
```json
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "status": "partial",
  "results": {
    "fr-FR": "https://storage.com/video-fr.mp4",
    "de-DE": { "error": "ffmpeg merge failed: unsupported codec" }
  }
}
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Local | Production |
|----------|-------|------------|
| `PORT` | 8080 | (Railway assigns) |
| `CUSTOM_DUBBING_SECRET` | (empty for testing) | `openssl rand -base64 32` |
| `SERVER_URL` | `http://localhost:8080` | `https://your-server.railway.app` |
| `STORAGE_TYPE` | `local` | TBD |

## File Structure

```
Backend/
├── server.js                    # Main entry point
├── package.json                 # Dependencies
├── .env                         # Environment config (not committed)
├── .env.example                 # Template
├── public/
│   ├── test.html                # Local test page
│   └── output/                  # Merged videos (local storage)
├── temp/                        # Downloaded files (temp)
├── src/
│   ├── routes/
│   │   ├── health.js            # GET /health
│   │   ├── merge.js             # POST /merge (production)
│   │   └── testMerge.js         # POST /test/* (testing)
│   ├── middleware/
│   │   └── auth.js              # x-dubbing-secret validation
│   └── services/
│       ├── downloadService.js   # Download video/audio files
│       ├── ffmpegService.js     # Merge with ffmpeg
│       ├── storageService.js    # Save & generate URLs
│       └── webhookService.js    # Call webhook
└── test/
    └── fakeWebhookReceiver.js   # Local webhook simulator
```

## Prerequisites

### ffmpeg
This server requires ffmpeg to be installed:

**Windows:**
```bash
choco install ffmpeg
```
Or download from https://ffmpeg.org/download.html

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
apt-get install ffmpeg
```

Verify: `ffmpeg -version`

## Deployment (Railway)

Only after Step 6 passes locally:

1. Push all code to GitHub
2. Connect GitHub repo to Railway
3. Set environment variables on Railway:
   - `CUSTOM_DUBBING_SECRET` (generate with `openssl rand -base64 32`)
   - `SERVER_URL` (Railway assigns this)
   - `STORAGE_TYPE` (confirm storage choice first)
4. Deploy
5. Update `CUSTOM_DUBBING_SERVER_URL` on Vercel to point to Railway URL

## Decisions Needed

### 1. Audio/Video Duration Mismatch (Step 2)
When audio duration ≠ video duration:
- **Option A:** Trim/pad audio to match video (current)
- **Option B:** Time-stretch audio with `atempo`
- **Option C:** Freeze last frame to extend video

**Action:** Flag this choice before finalizing

### 2. Storage Solution (Step 4)
Current: Local disk (`public/output/`)
Options:
- **Keep local:** Simple, but files lost on Railway restart
- **Free tier cloud:** Cloudinary, file.io, etc.
- **Cloudflare R2:** Same as main app, production-ready

**Action:** Flag before production deployment

## Status Checklist

- [x] Step 0: Project setup, /health endpoint
- [ ] Step 1: Test page loads and hits server
- [ ] Step 2: Single audio+video merge works
- [ ] Step 3: Multiple tracks work
- [ ] Step 4: Storage/URLs work
- [ ] Step 5: Webhook integration works
- [ ] Step 6: Full /merge endpoint works
- [ ] Deployed to Railway
- [ ] Tested end-to-end in production

## Notes

- This server is fully decoupled from the Next.js app
- It never touches the app's database
- Communication only via HTTP (job in, webhook out)
- Keep test.html in repo for debugging production
