# Video Dubbing API

A Node.js server for automated video dubbing with transcription, translation, and text-to-speech. Process videos in multiple languages simultaneously with cloud storage integration.

## Features

- 🎬 **Full Dubbing Pipeline** - Extract audio → Transcribe → Translate → Generate Speech → Merge
- 🌍 **Multi-language Support** - Process multiple target languages in one request
- ☁️ **Cloud Storage** - Automatic upload to Cloudflare R2 (10GB free)
- 🗣️ **High-Quality TTS** - Kokoro-82M via Replicate
- 📝 **99+ Languages** - AssemblyAI transcription supports 99+ languages
- 🔄 **Automatic Translation** - DeepL API integration
- ⚡ **Fast Processing** - 30-60 seconds per video
- 🧹 **Auto Cleanup** - Automatic removal of temporary files

## Quick Start

### Prerequisites

- Node.js 14+
- FFmpeg installed

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your API keys (see Configuration section)

# Start the server
npm start
```

Server runs on `http://localhost:8080`

## API Endpoints

### 1. Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.45
}
```

---

### 2. Submit Dubbing Job (URL)

**POST** `/api/dubbing/async/single`

Submit a dubbing job using a video URL. Returns immediately with a jobId for status tracking.

**Request Body:**
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "sourceLanguage": "es",
  "targetLanguages": ["en", "fr"]
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_1783512345678",
  "status": "pending",
  "message": "Job queued for processing",
  "statusUrl": "/api/dubbing/async/status/job_1783512345678",
  "estimatedTime": "30-60s"
}
```

---

### 3. Submit Dubbing Job (Upload)

**POST** `/api/dubbing/async/upload`

Submit a dubbing job with file upload. Returns immediately with a jobId for status tracking.

**Request (multipart/form-data):**
- `video` (file) - Video file to dub
- `sourceLanguage` (string) - Source language code
- `targetLanguages` (JSON array string) - e.g., `["en", "fr"]`

**Response:**
```json
{
  "success": true,
  "jobId": "job_1783512345678",
  "status": "pending",
  "message": "Job queued for processing",
  "statusUrl": "/api/dubbing/async/status/job_1783512345678",
  "estimatedTime": "30-60s"
}
```

---

### 4. Check Job Status

**GET** `/api/dubbing/async/status/:jobId`

Check the status of a dubbing job. Poll this endpoint to get job updates.

**Response (pending/processing):**
```json
{
  "success": true,
  "jobId": "job_1783512345678",
  "status": "processing",
  "message": "Job is being processed"
}
```

**Response (completed):**
```json
{
  "success": true,
  "jobId": "job_1783512345678",
  "status": "completed",
  "sourceLanguage": "es",
  "original": {
    "video": "https://example.com/video.mp4",
    "transcript": "Hola. ¿Cómo estás? Bien, gracias..."
  },
  "languages": {
    "en": {
      "success": true,
      "transcript": "Hola. ¿Cómo estás?...",
      "translation": "Hello. How are you? Fine, thanks...",
      "video": "https://pub-xxxxx.r2.dev/job_xxx_en.mp4",
      "processingTime": "45.23s"
    },
    "fr": {
      "success": true,
      "transcript": "Hola. ¿Cómo estás?...",
      "translation": "Bonjour. Comment vas-tu? Bien, merci...",
      "video": "https://pub-xxxxx.r2.dev/job_xxx_fr.mp4",
      "processingTime": "43.56s"
    }
  },
  "totalProcessingTime": "88.79s"
}
```

---

### 3. Dubbing API - File Upload

**POST** `/api/dubbing/upload`

Upload a video file and process dubbing.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `video` (file) - Video file (max 500MB)
- `sourceLanguage` (text) - Source language code (e.g., "es")
- `targetLanguages` (text) - JSON array of target languages (e.g., `["en", "fr"]`)

**Example (cURL):**
```bash
curl -X POST http://localhost:8080/api/dubbing/upload \
  -F "video=@/path/to/video.mp4" \
  -F "sourceLanguage=es" \
  -F 'targetLanguages=["en","fr"]'
}
```

**Response (failed):**
```json
{
  "success": true,
  "jobId": "job_1783512345678",
  "status": "failed",
  "error": "Transcription failed: Invalid audio format"
}
```

---

### 5. Web Interface - Dubbing Test

**GET** `/dubbing.html`

Interactive web interface for testing the dubbing API with async job processing.

**Features:**
- Upload video file or provide URL/path
- Select source language
- Select multiple target languages
- Automatic status polling every 5 seconds
- Download dubbed videos when complete
- Can close page and check status later with jobId

**Access:** `http://localhost:8080/dubbing.html` or `https://your-app.onrender.com/dubbing.html`

---

### 5. Legacy Endpoints

**POST** `/test/merge-one` - Merge single audio+video (legacy)  
**POST** `/test/merge-multiple` - Merge multiple audio tracks (legacy)  
**POST** `/merge` - Production merge endpoint (legacy)  
**GET** `/merge.html` - Merge test interface (legacy)

See sections below for legacy endpoint documentation.

---

## Supported Languages

### TTS Languages (Kokoro-82M)

**✅ Fully Supported:**
- `en` - English (Grade A voice)
- `es` - Spanish
- `fr` - French (Grade B-)
- `it` - Italian
- `pt` - Portuguese
- `hi` - Hindi

**⚠️ Not Currently Working:**
- `ja` - Japanese (Replicate deployment missing `fugashi` dependency)
- `zh` - Chinese (Replicate deployment missing dependencies)

**Note:** While the Kokoro model technically supports Japanese and Chinese, the current Replicate deployment (`alphanumericuser/kokoro-82m`) is missing required tokenization libraries. Use the 6 working languages above.

### Transcription Languages (AssemblyAI)
99+ languages supported including all major languages.

### Translation Languages (DeepL)
30+ languages supported including all major European and Asian languages.

---

## Configuration

### Required Environment Variables

Create a `.env` file with the following:

```env
# Server
PORT=8080
SERVER_URL=http://localhost:8080

# Replicate API (Kokoro TTS)
REPLICATE_API_TOKEN=your_replicate_token
KOKORO_MODEL=alphanumericuser/kokoro-82m
KOKORO_DEFAULT_VOICE=af_heart

# AssemblyAI (Transcription)
ASSEMBLYAI_API_KEY=your_assemblyai_key

# DeepL (Translation)
DEEPL_API_KEY=your_deepl_key

# Cloudflare R2 (Storage)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=dubbing-videos
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### Get API Keys

1. **Replicate**: https://replicate.com/ (Free tier available)
2. **AssemblyAI**: https://www.assemblyai.com/ (Free tier: 5 hours/month)
3. **DeepL**: https://www.deepl.com/pro-api (Free tier: 500k chars/month)
4. **Cloudflare R2**: https://dash.cloudflare.com/r2 (Free tier: 10GB storage)

### Cloudflare R2 Setup

1. Go to https://dash.cloudflare.com/ → R2
2. Create bucket: `dubbing-videos`
3. Enable public access (Settings → Public Development URL → Enable)
4. Create API token with Read & Write permissions
5. Copy credentials: Account ID, Access Key ID, Secret Access Key, Public URL

---

## Testing

### Web Interface (Recommended)

**Dubbing Interface:** `http://localhost:8080/dubbing.html`

The easiest way to test the async API:
1. Open the interface in your browser
2. Choose between "Video URL/Path" or "Upload Video"
3. Select source language (e.g., "Spanish")
4. Select target language(s) (e.g., "English", "French")
5. Click "Submit Dubbing Job"
6. View jobId and automatic status polling (every 5 seconds)
7. Download dubbed videos when complete
8. Can close page and return later - job continues processing

**Legacy Merge Interface:** `http://localhost:8080/merge.html`

---

### Postman / API Testing

#### Submit Job with URL

```
POST http://localhost:8080/api/dubbing/async/single
Content-Type: application/json

{
  "videoUrl": "https://example.com/video.mp4",
  "sourceLanguage": "es",
  "targetLanguages": ["en", "fr"]
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_1783595904186",
  "status": "pending",
  "statusUrl": "/api/dubbing/async/status/job_1783595904186"
}
```

#### Check Job Status

```
GET http://localhost:8080/api/dubbing/async/status/job_1783595904186
```

**Response (when completed):**
```json
{
  "success": true,
  "jobId": "job_1783595904186",
  "status": "completed",
  "sourceLanguage": "es",
  "results": {
    "en": {
      "success": true,
      "video": "https://pub-xxxxx.r2.dev/job_xxx_en.mp4",
      "processingTime": "23.23s"
    }
  }
}
```

---

### cURL Examples

#### Submit Job (URL)

```bash
curl -X POST http://localhost:8080/api/dubbing/async/single \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://example.com/video.mp4",
    "sourceLanguage": "es",
    "targetLanguages": ["en", "fr"]
  }'
```

#### Submit Job (File Upload)

```bash
curl -X POST http://localhost:8080/api/dubbing/async/upload \
  -F "video=@/path/to/video.mp4" \
  -F "sourceLanguage=es" \
  -F 'targetLanguages=["en","fr"]'
```

**Windows PowerShell:**
```powershell
curl.exe -X POST http://localhost:8080/api/dubbing/async/upload `
  -F "video=@C:/Users/YourName/Downloads/video.mp4" `
  -F "sourceLanguage=es" `
  -F "targetLanguages=[`"en`",`"fr`"]"
```

#### Check Status

```bash
curl http://localhost:8080/api/dubbing/async/status/job_1783595904186
```

---

### Important Notes

- **Timeout:** Set HTTP timeout to **5 minutes minimum**
  - Processing takes ~30-60s per target language
  - TTS is the bottleneck (90% of processing time)
  - Example: 3 languages = 90-180 seconds total
  
- **File Size:** Upload limit is 500MB per video

- **Processing Time Breakdown:**
  - Audio Extraction: <1s
  - Transcription: 5-10s
  - Translation: <1s
  - TTS (per language): 30-60s ⚠️ slowest step
  - Video Merge: <1s
  - R2 Upload: 1-3s

- **Output Storage:** All dubbed videos automatically upload to Cloudflare R2 and return public URLs

---

## How It Works

1. **Audio Extraction** - Extract audio from video using FFmpeg
2. **Transcription** - Transcribe audio to text using AssemblyAI
3. **Translation** - Translate text to target language(s) using DeepL
4. **Text-to-Speech** - Generate dubbed audio using Kokoro TTS (Replicate)
5. **Merge** - Merge new audio with original video using FFmpeg
6. **Upload** - Upload final video to Cloudflare R2
7. **Response** - Return R2 public URL for download

---

## Deployment

### Deploy to Render.com

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your repository
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Standard or higher (for FFmpeg processing)
5. Add all environment variables from `.env`:
   - `FIREBASE_CREDENTIALS` - **Copy entire firebase-credentials.json as single-line string**
   - `REPLICATE_API_TOKEN`
   - `KOKORO_MODEL`
   - `KOKORO_DEFAULT_VOICE`
   - `ASSEMBLYAI_API_KEY`
   - `DEEPL_API_KEY`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_PUBLIC_URL`
   - `PORT` (usually auto-set by Render)
   - `SERVER_URL` (set to your Render URL, e.g., `https://your-app.onrender.com`)
6. Deploy

### Production URLs

After deployment, your APIs will be available at:

**Dubbing API:**
```
POST https://your-app.onrender.com/api/dubbing/async/single
POST https://your-app.onrender.com/api/dubbing/async/upload
GET  https://your-app.onrender.com/api/dubbing/async/status/:jobId
```

**Web Interfaces:**
```
https://your-app.onrender.com/dubbing.html
https://your-app.onrender.com/merge.html
```

**Health Check:**
```
GET https://your-app.onrender.com/health
```

### Production Example

```bash
# Submit job
curl -X POST https://your-app.onrender.com/api/dubbing/async/upload \
  -F "video=@video.mp4" \
  -F "sourceLanguage=es" \
  -F 'targetLanguages=["en","fr"]'

# Response
{
  "success": true,
  "jobId": "job_1783595904186",
  "status": "pending",
  "statusUrl": "/api/dubbing/async/status/job_1783595904186"
}

# Check status (poll every 5-10 seconds)
curl https://your-app.onrender.com/api/dubbing/async/status/job_1783595904186
```

Response when complete will include R2 public URLs:
```json
{
  "success": true,
  "jobId": "job_1783595904186",
  "status": "completed",
  "results": {
    "en": {
      "video": "https://pub-xxxxx.r2.dev/job_xxx_en.mp4"
    },
    "fr": {
      "video": "https://pub-xxxxx.r2.dev/job_xxx_fr.mp4"
    }
  }
}
```

---

### Test: Merge with File Paths

**POST** `/test/merge-one`

Merge a single audio and video file using local file paths.

**Request Body:**
```json
{
  "videoPath": "C:/path/to/video.mp4",
  "audioPath": "C:/path/to/audio.mp3",
  "outputName": "merged.mp4"
}
```

**Response:**
```json
{
  "status": "success",
  "outputUrl": "http://localhost:8080/output/merged.mp4",
  "outputPath": "/output/merged.mp4",
  "outputFile": "merged.mp4",
  "duration": 1063,
  "fileSize": 2487913,
  "outputDuration": 5.09,
  "inputDurations": {
    "video": 5.76,
    "audio": 5.09
  },
  "message": "Audio and video merged successfully"
}
```

---

### Test: Merge with File Upload

**POST** `/test/merge-one-upload`

Merge audio and video files uploaded via multipart/form-data.

**Form Data:**
- `video` (file) - Video file to process
- `audio` (file) - Audio file to merge
- `outputName` (text, optional) - Output filename

**Response:** Same as `/test/merge-one`

**Example (cURL):**
```bash
curl -X POST http://localhost:8080/test/merge-one-upload \
  -F "video=@video.mp4" \
  -F "audio=@audio.mp3" \
  -F "outputName=merged.mp4"
```

---

### Test: Merge Multiple Audio Tracks (File Paths)

**POST** `/test/merge-multiple`

Merge one video with multiple audio tracks (different languages) using local file paths.

**Request Body:**
```json
{
  "videoPath": "C:/path/to/video.mp4",
  "audioTracks": [
    {
      "language": "es-ES",
      "audioPath": "C:/path/to/spanish.mp3"
    },
    {
      "language": "fr-FR",
      "audioPath": "C:/path/to/french.mp3"
    },
    {
      "language": "en-US",
      "audioPath": "C:/path/to/english.mp3"
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "processed": 3,
  "successful": 3,
  "failed": 0,
  "duration": 3245,
  "results": [
    {
      "language": "es-ES",
      "status": "success",
      "outputUrl": "http://localhost:8080/output/merged_es-ES_123.mp4",
      "outputFile": "merged_es-ES_123.mp4",
      "fileSize": 15728640,
      "duration": 120.5,
      "inputDuration": 121.0
    },
    {
      "language": "fr-FR",
      "status": "success",
      "outputUrl": "http://localhost:8080/output/merged_fr-FR_456.mp4",
      "outputFile": "merged_fr-FR_456.mp4",
      "fileSize": 15820544,
      "duration": 120.5,
      "inputDuration": 120.8
    },
    {
      "language": "en-US",
      "status": "success",
      "outputUrl": "http://localhost:8080/output/merged_en-US_789.mp4",
      "outputFile": "merged_en-US_789.mp4",
      "fileSize": 15650240,
      "duration": 120.5,
      "inputDuration": 120.3
    }
  ]
}
```

**Limits:**
- No hard limit on number of tracks
- Practical limit: ~20-30 tracks (processing time)

---

### Test: Merge Multiple Audio Tracks (File Upload)

**POST** `/test/merge-multiple-upload`

Merge one video with multiple audio tracks using file uploads.

**Form Data:**
- `video` (file) - Video file to process
- `audios` (files, multiple) - Multiple audio files (up to 50)
- `languages` (text) - JSON array of language codes matching audio files order

**Example (cURL):**
```bash
curl -X POST http://localhost:8080/test/merge-multiple-upload \
  -F "video=@video.mp4" \
  -F "audios=@spanish.mp3" \
  -F "audios=@french.mp3" \
  -F "audios=@english.mp3" \
  -F 'languages=["es-ES","fr-FR","en-US"]'
```

**Response:** Same structure as `/test/merge-multiple`

**Limits:**
- Maximum 50 audio files per request
- Each file: 500MB max
- Processing time: ~0.5-2s per audio track

---

### Production: Full Merge Job

**POST** `/merge`

Production endpoint for processing merge jobs with webhook notifications.

**Headers:**
- `x-dubbing-secret` (required) - Authentication secret
- `Content-Type: application/json`

**Request Body:**
```json
{
  "jobId": "job_12345",
  "projectId": "proj_abc",
  "videoUrl": "https://example.com/video.mp4",
  "audioTracks": [
    {
      "language": "es-ES",
      "audioUrl": "https://example.com/audio-spanish.mp3"
    },
    {
      "language": "fr-FR",
      "audioUrl": "https://example.com/audio-french.mp3"
    }
  ],
  "webhookUrl": "https://your-app.com/webhook"
}
```

**Response:**
```json
{
  "status": "accepted",
  "jobId": "job_12345",
  "message": "Job accepted and processing"
}
```

**Webhook Callback:**

When processing completes, the server calls your webhook:

```json
{
  "jobId": "job_12345",
  "projectId": "proj_abc",
  "status": "completed",
  "results": [
    {
      "language": "es-ES",
      "downloadUrl": "http://localhost:8080/output/video_es-ES_123.mp4",
      "duration": 120.5,
      "fileSize": 15728640
    },
    {
      "language": "fr-FR",
      "downloadUrl": "http://localhost:8080/output/video_fr-FR_456.mp4",
      "duration": 120.5,
      "fileSize": 15820544
    }
  ]
}
```

## FFmpeg Command

The server uses the following FFmpeg command for optimal quality and performance:

```bash
ffmpeg -i <video> -i <audio> -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest -y <output>
```

**Flags explained:**
- `-c:v copy` - Copy video stream without re-encoding (preserves quality, fast)
- `-c:a aac` - Encode audio to AAC (universal compatibility)
- `-map 0:v:0` - Use video from first input
- `-map 1:a:0` - Use audio from second input
- `-shortest` - Trim output to shortest input (handles duration mismatches)
- `-y` - Overwrite output file without prompting

**Benefits:**
- ⚡ Fast processing (~0.5-2s for typical videos)
- 🎨 Original video quality preserved
- 🔊 Universal audio compatibility (AAC)
- 🎯 Perfect audio/video sync

---

## Legacy Endpoints (Merge-Only)

These endpoints provide basic audio/video merging without dubbing pipeline.

### Duration Mismatch Handling

When audio and video durations don't match, the server uses the `-shortest` flag:

- **Video longer than audio:** Video is trimmed to audio length
- **Audio longer than video:** Audio is trimmed to video length

**Example:**
- 60s video + 30s audio = 30s output
- 30s video + 60s audio = 30s output

This ensures perfect synchronization without quality loss.

### Current Strategy: Trim to Shortest (Option A)

**Pros:**
- ✅ Perfect synchronization
- ✅ No quality degradation
- ✅ Fast processing (no re-encoding)
- ✅ Predictable output duration

**Cons:**
- ⚠️ May cut content if mismatch is large (>5 seconds)

### Alternative Strategies (Not Implemented)

**Option B: Time-Stretch Audio**
- Stretch or compress audio to match video duration exactly
- Uses FFmpeg `atempo` filter
- **Use when:** Small differences (<5%), audio content is critical
- **Drawback:** Audio sounds faster/slower (noticeable if >5% difference)

**Option C: Extend Video**
- Freeze last video frame to match longer audio
- **Use when:** Video ends with static content (credits, logo)
- **Drawback:** Video freezes, looks unnatural for dynamic content

**To request a different strategy, open an issue or discuss with maintainers.**

## Project Structure

```
Backend/
├── src/
│   ├── dubbing-pipeline/
│   │   ├── routes/
│   │   │   └── dubbing.js         # Main dubbing API routes
│   │   └── services/
│   │       ├── audioExtractionService.js
│   │       ├── transcriptionService.js
│   │       ├── translationService.js
│   │       └── ttsService.js
│   ├── merge-only/
│   │   ├── middleware/
│   │   │   └── auth.js            # Authentication middleware
│   │   ├── routes/
│   │   │   ├── health.js          # Health check endpoint
│   │   │   ├── merge.js           # Production merge endpoint
│   │   │   └── testMerge.js       # Test/legacy endpoints
│   │   └── services/
│   │       ├── ffmpegService.js   # FFmpeg merge logic
│   │       ├── downloadService.js
│   │       ├── storageService.js
│   │       ├── video.js
│   │       └── webhookService.js
│   ├── shared/
│   │   ├── services/
│   │   │   └── r2Service.js       # Cloudflare R2 storage
│   │   └── utils/
│   │       └── cleanup.js         # Auto cleanup service
│   └── config/
│       └── voices.js              # TTS voice configuration
├── public/
│   ├── output/                    # Merged video outputs (temp)
│   ├── dubbing.html              # Dubbing test interface
│   └── merge.html                # Merge test interface (legacy)
├── temp/                          # Temporary files (auto-cleaned)
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server.js
└── README.md
```

## Deployment

### Other Deployment Platforms

The included Dockerfile works with any platform supporting Docker:

- **Heroku**: Uses buildpacks, FFmpeg included
- **DigitalOcean App Platform**: Supports Dockerfile
- **AWS ECS / Fargate**: Deploy container directly
- **Google Cloud Run**: Serverless container deployment
- **Azure Container Instances**: Quick container hosting
- **Railway**: Simple deployment with GitHub integration

**Note:** All platforms must support FFmpeg. The Dockerfile includes FFmpeg installation.

## Troubleshooting

### Dubbing API Issues

**"ffmpeg is not recognized"**

Install FFmpeg and ensure it's in your PATH:
```bash
ffmpeg -version
```

If installed but not recognized, restart your terminal.

**"Input file not found"**

- Use absolute paths, not relative paths
- On Windows, use forward slashes: `C:/path/to/file.mp4`
- Or escaped backslashes: `C:\\path\\to\\file.mp4`

**"Request timeout" / "504 Gateway Timeout"**

- Increase HTTP client timeout to 5+ minutes
- TTS processing takes 30-60s per language
- Example: 3 languages = 90-180 seconds minimum

**"AssemblyAI transcription failed"**

- Check `ASSEMBLYAI_API_KEY` is valid
- Verify you haven't exceeded free tier (5 hours/month)
- Check audio file is valid format (MP3, WAV, etc.)

**"DeepL translation failed"**

- Check `DEEPL_API_KEY` is valid (must end with `:fx` for free tier)
- Verify character limit not exceeded (500k/month free)
- Ensure source/target language combination is supported

**"Replicate TTS failed"**

- Check `REPLICATE_API_TOKEN` is valid
- Verify Kokoro model name: `alphanumericuser/kokoro-82m`
- Check target language is supported by Kokoro
- **Japanese/Chinese not working?** The Replicate deployment is missing dependencies (`fugashi` for ja, tokenizers for zh). Use supported languages: en, es, fr, it, pt, hi

**"R2 upload failed"**

- Verify all R2 credentials in `.env` are correct
- Check bucket name matches: `R2_BUCKET_NAME=dubbing-videos`
- Ensure bucket has public access enabled
- Verify R2 public URL is correct

### Legacy Merge Issues

**Merge fails with "Command failed"**

- Verify FFmpeg is installed: `ffmpeg -version`
- Check input files are valid video/audio formats
- Ensure files aren't corrupted

**Output plays but audio is wrong**

- Verify the `-map` parameters in ffmpegService.js
- Check that audio file is in a supported format (MP3, WAV, AAC)

**Duration mismatch warning**

This is informational, not an error. The output will be trimmed to the shortest input duration.

## Development

### Run in development mode

```bash
npm run dev
```

### Run webhook test receiver

```bash
npm run test:webhook
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with:** Node.js, Express, FFmpeg  
**Repository:** [https://github.com/Tetsuuya/Audio-Video-Merge-Server](https://github.com/Tetsuuya/Audio-Video-Merge-Server)
