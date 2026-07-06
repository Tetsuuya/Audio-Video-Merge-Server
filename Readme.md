# Audio-Video Merge Server

A standalone Node.js server for merging audio tracks with video files using FFmpeg. Built for dubbing pipelines where videos need to be paired with dubbed audio in multiple languages.

## Features

- 🎬 **Audio/Video Merging** - Replace video audio with dubbed audio tracks
- ⚡ **Fast Processing** - Uses FFmpeg with video stream copy (no re-encoding)
- 🌍 **Multi-language Support** - Handle multiple audio tracks for different languages
- 🔒 **Secure** - Authentication via custom secret header
- 📦 **Docker Ready** - Includes Dockerfile with FFmpeg pre-installed
- 🧪 **Test Endpoints** - Easy testing with local files or uploads

## Quick Start

### Prerequisites

- Node.js 14+
- FFmpeg installed (see [Installation](#ffmpeg-installation))

### Installation

```bash
# Clone the repository
git clone https://github.com/Tetsuuya/Audio-Video-Merge-Server.git
cd Audio-Video-Merge-Server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Required: CUSTOM_DUBBING_SECRET

# Start the server
npm start
```

Server runs on `http://localhost:8080`

### Docker Installation

```bash
# Build and run with Docker Compose
docker-compose up

# Or build manually
docker build -t merge-server .
docker run -p 8080:8080 --env-file .env merge-server
```

Docker automatically includes FFmpeg, no separate installation needed.

## FFmpeg Installation

### Windows
```powershell
# Using winget
winget install "Gyan.FFmpeg"

# Using Chocolatey
choco install ffmpeg
```

### macOS
```bash
brew install ffmpeg
```

### Linux
```bash
sudo apt install ffmpeg
```

### Verify Installation
```bash
ffmpeg -version
```

## API Endpoints

### Health Check

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

**Test with file paths:**
```json
POST http://localhost:8080/test/merge-one
Content-Type: application/json

{
  "videoPath": "C:\\Users\\YourName\\Downloads\\video.mp4",
  "audioPath": "C:\\Users\\YourName\\Downloads\\audio.mp3"
}
```

**Test with file upload:**
```
POST http://localhost:8080/test/merge-one-upload
Content-Type: multipart/form-data

video: <select file>
audio: <select file>
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
