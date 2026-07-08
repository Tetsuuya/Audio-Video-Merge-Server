# Video Dubbing API

A Node.js server for automated video dubbing with transcription, translation, and text-to-speech. Process videos in multiple languages simultaneously with cloud storage integration.

## Features

- 🎬 **Full Dubbing Pipeline** - Extract audio → Transcribe → Translate → Generate Speech → Merge
- 🌍 **Multi-language Support** - Process multiple target languages in one request
- ☁️ **Cloud Storage** - Automatic upload to Cloudinary (10GB free)
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

### 2. Dubbing API - Single Language

**POST** `/api/dubbing/single`

Dub a video into one target language.

**Request Body:**
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "sourceLanguage": "es",
  "targetLanguage": "en"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_1783512345678",
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
      "video": "https://res.cloudinary.com/.../dubbed_es_to_en_xxx.mp4",
      "processingTime": "45.23s"
    }
  },
  "totalProcessingTime": "45.23s"
}
```

---

### 3. Dubbing API - Multiple Languages

**POST** `/api/dubbing/single`

Dub a video into multiple target languages simultaneously.

**Request Body:**
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "sourceLanguage": "es",
  "targetLanguages": ["en", "fr", "it"]
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_1783512345678",
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
      "video": "https://res.cloudinary.com/.../dubbed_es_to_en_xxx.mp4",
      "processingTime": "45.23s"
    },
    "fr": {
      "success": true,
      "transcript": "Hola. ¿Cómo estás?...",
      "translation": "Bonjour. Comment vas-tu? Bien, merci...",
      "video": "https://res.cloudinary.com/.../dubbed_es_to_fr_xxx.mp4",
      "processingTime": "43.56s"
    },
    "it": {
      "success": true,
      "transcript": "Hola. ¿Cómo estás?...",
      "translation": "Ciao. Come stai? Bene, grazie...",
      "video": "https://res.cloudinary.com/.../dubbed_es_to_it_xxx.mp4",
      "processingTime": "44.12s"
    }
  },
  "totalProcessingTime": "132.91s"
}
```

---

### 4. Legacy Endpoints

**POST** `/test/merge-one` - Merge audio and video (legacy)  
**POST** `/test/merge-multiple` - Merge multiple audio tracks (legacy)  
**POST** `/merge` - Production merge endpoint (legacy)

See full documentation in sections below.

---

## Supported Languages

### TTS Languages (Kokoro-82M)
- `en` - English
- `es` - Spanish
- `fr` - French
- `it` - Italian
- `pt` - Portuguese
- `hi` - Hindi
- `ja` - Japanese
- `zh` - Chinese

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

# Cloudinary (Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Get API Keys

1. **Replicate**: https://replicate.com/ (Free tier available)
2. **AssemblyAI**: https://www.assemblyai.com/ (Free tier: 5 hours/month)
3. **DeepL**: https://www.deepl.com/pro-api (Free tier: 500k chars/month)
4. **Cloudinary**: https://cloudinary.com/ (Free tier: 10GB storage)

---

## Testing

### Postman Example - Single Language

```
POST http://localhost:8080/api/dubbing/single
Content-Type: application/json

{
  "videoUrl": "C:/Users/YourName/Downloads/test-spanish.mp4",
  "sourceLanguage": "es",
  "targetLanguage": "en"
}
```

### Postman Example - Multiple Languages

```
POST http://localhost:8080/api/dubbing/single
Content-Type: application/json

{
  "videoUrl": "https://example.com/video.mp4",
  "sourceLanguage": "es",
  "targetLanguages": ["en", "fr", "it"]
}
```

### cURL Example

```bash
curl -X POST http://localhost:8080/api/dubbing/single \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://example.com/video.mp4",
    "sourceLanguage": "es",
    "targetLanguages": ["en", "fr"]
  }'
```

**Note:** Set timeout to 120 seconds minimum as processing takes 30-60s per language.

---

## How It Works

1. **Audio Extraction** - Extract audio from video using FFmpeg
2. **Transcription** - Transcribe audio to text using AssemblyAI
3. **Translation** - Translate text to target language(s) using DeepL
4. **Text-to-Speech** - Generate dubbed audio using Kokoro TTS (Replicate)
5. **Merge** - Merge new audio with original video using FFmpeg
6. **Upload** - Upload final video to Cloudinary
7. **Response** - Return Cloudinary URL for download

---

## Deployment

### Deploy to Render.com

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your repository
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add all environment variables from `.env`
6. Deploy

### Production URL

After deployment, your API will be available at:
```
https://your-app.onrender.com/api/dubbing/single
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

## Testing

### Web Interface

Open `http://localhost:8080/test.html` for an interactive testing interface.

Or use the simpler version: `http://localhost:8080/simple-test.html`

### Postman

Import the included Postman collection or test manually:

**Test single merge with file paths:**
```json
POST http://localhost:8080/test/merge-one
Content-Type: application/json

{
  "videoPath": "C:\\Users\\YourName\\Downloads\\video.mp4",
  "audioPath": "C:\\Users\\YourName\\Downloads\\audio.mp3"
}
```

**Test multiple merges with file paths:**
```json
POST http://localhost:8080/test/merge-multiple
Content-Type: application/json

{
  "videoPath": "C:\\Users\\YourName\\Downloads\\video.mp4",
  "audioTracks": [
    {
      "language": "es-ES",
      "audioPath": "C:\\Users\\YourName\\Downloads\\spanish.mp3"
    },
    {
      "language": "fr-FR",
      "audioPath": "C:\\Users\\YourName\\Downloads\\french.mp3"
    }
  ]
}
```

**Test with file upload:**
```
POST http://localhost:8080/test/merge-one-upload
Content-Type: multipart/form-data

video: <select file>
audio: <select file>
```

**Test multiple uploads:**
```
POST http://localhost:8080/test/merge-multiple-upload
Content-Type: multipart/form-data

video: <select file>
audios: <select multiple files>
languages: ["es-ES","fr-FR","en-US"]
```

### Node.js Test Script

```bash
# Edit paths in test-merge-simple.js
node test-merge-simple.js
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
# Server Configuration
PORT=8080
NODE_ENV=development

# Authentication (required for /merge endpoint)
CUSTOM_DUBBING_SECRET=your-secret-here

# Server URL for download URLs
SERVER_URL=http://localhost:8080

# Storage (for future cloud storage integration)
STORAGE_TYPE=local
```

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
│   ├── middleware/
│   │   └── auth.js           # Authentication middleware
│   ├── routes/
│   │   ├── health.js         # Health check endpoint
│   │   ├── merge.js          # Production merge endpoint
│   │   └── testMerge.js      # Test endpoints
│   ├── services/
│   │   ├── ffmpegService.js  # FFmpeg merge logic
│   │   ├── downloadService.js
│   │   ├── storageService.js
│   │   └── webhookService.js
│   └── utils/
│       └── cleanup.js
├── public/
│   ├── output/               # Merged video outputs
│   ├── test.html            # Full test interface
│   └── simple-test.html     # Simple test interface
├── temp/                     # Temporary upload files
├── storage/                  # Local storage (if not using cloud)
├── test/
│   └── fakeWebhookReceiver.js
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server.js
└── README.md
```

## Deployment

### Railway

1. Push to GitHub
2. Connect repository to Railway
3. Add environment variables
4. Deploy

Railway includes FFmpeg in base images automatically.

### Other Platforms

Use the included Dockerfile for any platform supporting Docker:

- Heroku
- DigitalOcean App Platform
- AWS ECS
- Google Cloud Run
- Azure Container Instances

## Troubleshooting

### "ffmpeg is not recognized"

Install FFmpeg and ensure it's in your PATH:
```bash
ffmpeg -version
```

If installed but not recognized, restart your terminal.

### "Input file not found"

- Use absolute paths, not relative paths
- On Windows, use forward slashes: `C:/path/to/file.mp4`
- Or escaped backslashes: `C:\\path\\to\\file.mp4`

### Merge fails with "Command failed"

- Verify FFmpeg is installed: `ffmpeg -version`
- Check input files are valid video/audio formats
- Ensure files aren't corrupted

### Output plays but audio is wrong

- Verify the `-map` parameters in ffmpegService.js
- Check that audio file is in a supported format (MP3, WAV, AAC)

### Duration mismatch warning

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
