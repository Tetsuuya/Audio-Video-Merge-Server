# Audio-Video Merge & Dubbing Server - Architecture & ERD Diagram

The `erd.md` file holds all the architectural and design diagrams for the project. Initially, the project did not have a database (hence the generic system diagrams), but it has since been updated to use **Firebase Firestore** for tracking async dubbing jobs.

Below is the Entity Relationship Diagram (ERD) of the Firestore database, followed by the system architecture diagrams.

## Database Schema / Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    Job ||--o{ JobLanguageResult : "has results per language"
    
    Job {
        string jobId PK "Document ID"
        string status "'pending' | 'processing' | 'completed' | 'failed'"
        string videoUrl "Source video location (URL or filename)"
        string sourceLanguage "Original language code (e.g. 'es')"
        string_array targetLanguages "Requested target languages"
        string error "Error message if job failed"
        timestamp createdAt "Timestamp when job was created"
        timestamp updatedAt "Timestamp of last modification"
        timestamp completedAt "Timestamp when job finished processing"
    }
    
    JobLanguageResult {
        string language_key PK "Map key (e.g. 'en', 'fr')"
        boolean success "Whether dubbing for this language succeeded"
        string video "Public R2 Cloud URL of the dubbed video"
        string transcript "Extracted original transcript text"
        string translation "Translated script text"
        string processingTime "Time taken to process this specific language"
        string error "Error message if language specific dubbing failed"
    }
```

## System Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        A[Web Browser / HTML Test Clients]
        B[Next.js Application]
        C[Mobile Application]
    end

    subgraph "API Layer"
        D[Express Server<br/>Port 8080]
        E[Multer File Upload]
    end

    subgraph "Routes"
        subgraph "Merge-Only Route Namespace"
            G["/health"]
            H["/test/merge-one"]
            I["/test/merge-one-upload"]
            J["/test/merge-multiple"]
            K["/test/merge-multiple-upload"]
            L["/merge<br/>Production"]
        end
        subgraph "Dubbing Pipeline Route Namespace"
            DA1["/api/dubbing/async/single"]
            DA2["/api/dubbing/async/upload"]
            DA3["/api/dubbing/async/status/:jobId"]
        end
    end

    subgraph "Services & Processors"
        DP[Dubbing Processor]
        
        subgraph "Merge-Only Services"
            M[FFmpeg Service<br/>Audio/Video Merge]
            N[Download Service]
            O[Storage Service]
            P[Webhook Service]
        end
        
        subgraph "Dubbing Pipeline Services"
            AES[Audio Extraction Service]
            TS[Transcription Service]
            TLS[Translation Service]
            TTSS[TTS Service]
        end

        subgraph "Shared Infrastructure Services"
            R2S[Cloudflare R2 Service]
            FBS[Firebase Firestore Service]
            CS[Cleanup Service]
        end
    end

    subgraph "Storage & Database"
        DB[(Firestore DB<br/>Job Statuses)]
        T_DIR[(temp/<br/>Local Temp Files)]
        O_DIR[(public/output/<br/>Local Output Files)]
    end

    subgraph "External Integration APIs"
        EXT_FFMPEG[FFmpeg Binary]
        EXT_AAI[AssemblyAI API<br/>Transcription]
        EXT_DEEPL[DeepL API<br/>Translation]
        EXT_REPLICATE[Replicate API<br/>Kokoro-82M TTS]
        EXT_R2[Cloudflare R2<br/>Cloud Storage]
        EXT_WEBHOOK[Webhook Receiver]
    end

    A --> D
    B --> D
    C --> D
    
    D --> E
    E --> G
    E --> H
    E --> I
    E --> J
    E --> K
    E --> L
    E --> DA1
    E --> DA2
    E --> DA3
    
    %% Merge-Only connections
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
    L --> N
    L --> P
    M --> EXT_FFMPEG
    M --> O_DIR
    N --> T_DIR
    O --> O_DIR
    P --> EXT_WEBHOOK
    
    %% Dubbing pipeline connections
    DA1 --> FBS
    DA2 --> FBS
    DA1 --> DP
    DA2 --> DP
    DA3 --> FBS
    
    DP --> AES
    DP --> TS
    DP --> TLS
    DP --> TTSS
    DP --> M
    DP --> R2S
    DP --> FBS
    
    AES --> EXT_FFMPEG
    TS --> EXT_AAI
    TLS --> EXT_DEEPL
    TTSS --> EXT_REPLICATE
    R2S --> EXT_R2
    FBS --> DB
    
    CS --> T_DIR
    CS --> O_DIR
    CS --> FBS
    
    style D fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff
    style DP fill:#E24A4A,stroke:#8A2E2E,stroke-width:2px,color:#fff
    style EXT_FFMPEG fill:#50C878,stroke:#2E8A4A,stroke-width:2px,color:#fff
    style EXT_AAI fill:#8A2EE2,stroke:#5c1fa1,stroke-width:2px,color:#fff
    style EXT_DEEPL fill:#FF8C00,stroke:#d17300,stroke-width:2px,color:#fff
    style EXT_REPLICATE fill:#FF1493,stroke:#c40c6e,stroke-width:2px,color:#fff
    style DB fill:#FFCC00,stroke:#cca000,stroke-width:2px,color:#000
    style EXT_R2 fill:#FF7F50,stroke:#d15e34,stroke-width:2px,color:#fff
```

## Request Flow Diagrams

### Async Dubbing Pipeline Flow (Multi-Language)

```mermaid
sequenceDiagram
    participant Client as Client Application
    participant API as Express API
    participant DB as Firebase Firestore
    participant Processor as Dubbing Processor
    participant AES as Audio Extraction
    participant TS as Transcription (AssemblyAI)
    participant TLS as Translation (DeepL)
    participant TTS as TTS (Kokoro-82M)
    participant FFmpeg as FFmpeg Service
    participant R2 as Cloudflare R2
    
    Client->>API: POST /api/dubbing/async/upload or /single
    Note over API: Generate jobId
    API->>DB: createJob(jobId, status: "pending")
    API-->>Client: 202 Accepted { jobId, statusUrl }
    
    par Background Processing
        API->>Processor: Process Job (Background)
        Processor->>DB: updateJobStatus(jobId, "processing")
        
        Processor->>AES: extractAudio(video)
        AES-->>Processor: Returns audio_audio.wav
        
        Processor->>TS: transcribeAudio(audio_audio.wav)
        Note over TS: Uploads wav to AssemblyAI
        Note over TS: Polls for transcription
        TS-->>Processor: Returns original transcript text
        
        loop For each target language
            Processor->>TLS: translateText(transcript, sourceLang, targetLang)
            TLS-->>Processor: Returns translated text
            
            Processor->>TTS: generateSpeech(translation, targetLang)
            Note over TTS: Calls Replicate Kokoro-82M
            TTS-->>Processor: Returns dubbed wav path
            
            Processor->>FFmpeg: mergeAudioVideo(video, dubbed_wav)
            FFmpeg-->>Processor: Returns merged video path
            
            Processor->>R2: uploadVideo(merged_video)
            R2-->>Processor: Returns public URL & deletes local output file
            
            Processor->>DB: updateJobResult(jobId, language, result_url)
        end
        
        Processor->>DB: updateJobStatus(jobId, "completed")
        Note over Processor: Deletes local input video & temp files
    end
    
    loop Poll Job Status
        Client->>API: GET /api/dubbing/async/status/:jobId
        API->>DB: getJob(jobId)
        DB-->>API: Return Job Data
        API-->>Client: Return Status (completed / processing / pending)
    end
```

### Single Audio/Video Merge Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as Express API
    participant Upload as Multer
    participant FFmpeg as FFmpeg Service
    participant Storage as File System
    
    Client->>API: POST /test/merge-one-upload
    API->>Upload: Handle file upload
    Upload->>Storage: Save to temp/
    Upload-->>API: Return file paths
    
    API->>FFmpeg: mergeAudioVideo(video, audio)
    FFmpeg->>FFmpeg: Check durations
    FFmpeg->>FFmpeg: Run ffmpeg command
    Note over FFmpeg: ffmpeg -i video -i audio<br/>-c:v copy -c:a aac<br/>-shortest output.mp4
    FFmpeg->>Storage: Save to public/output/
    FFmpeg-->>API: Return output path
    
    API->>Storage: Delete temp files
    API->>API: Generate download URL
    API-->>Client: Return success + URL
    
    Client->>Storage: Download merged video
```

### Multiple Audio Tracks Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as Express API
    participant FFmpeg as FFmpeg Service
    participant Storage as File System
    
    Client->>API: POST /test/merge-multiple-upload<br/>(1 video + N audios)
    
    loop For each audio track
        API->>FFmpeg: mergeAudioVideo(video, audio[i])
        FFmpeg->>FFmpeg: Run ffmpeg merge
        FFmpeg->>Storage: Save merged_lang_timestamp.mp4
        FFmpeg-->>API: Return result
        API->>API: Collect result
    end
    
    API->>Storage: Delete temp files
    API->>API: Generate download URLs
    API-->>Client: Return batch results<br/>{successful: N, results: []}
```

## Data Flow

### Dubbing and Processing Data Flow

```mermaid
flowchart TD
    subgraph "Input Phase"
        A1[Client Video Upload] -->|Multer| B1[temp/ video.mp4]
        A2[Client Video URL] -->|Download Service| B1[temp/ video.mp4]
    end
    
    subgraph "Extraction & Transcription"
        B1 -->|FFmpeg Extract| C1[temp/ video_audio.wav]
        C1 -->|AssemblyAI Upload| C2[AssemblyAI Server]
        C2 -->|Polling| C3[Original Transcript Text]
    end

    subgraph "Dubbing Pipeline (Per Target Language)"
        C3 -->|DeepL API| D1[Translated Text]
        D1 -->|Replicate Kokoro-82M API| D2[temp/ tts_lang_timestamp.wav]
        B1 -->|FFmpeg Merge| D3[FFmpeg Video + Translated Audio]
        D2 -->|FFmpeg Merge| D3
        D3 -->|Output| D4[public/output/ dubbed_*.mp4]
    end

    subgraph "Storage & Cloud Delivery"
        D4 -->|Cloudflare R2 Upload| E1[R2 Storage Bucket]
        E1 -->|Public Cloud URL| E2[Client Retrieval]
        D4 -->|Delete Local File| E3[Cleanup]
    end

    subgraph "Status & Logging"
        F1[(Firestore Database)]
        A1 -.->|Create Job: pending| F1
        A2 -.->|Create Job: pending| F1
        B1 -.->|Update Status: processing| F1
        D4 -.->|Update Result: language urls| F1
        E1 -.->|Update Status: completed| F1
    end
```

## Component Architecture

```mermaid
graph TB
    subgraph "Express Server"
        A[server.js<br/>Entry Point]
        
        subgraph "Middleware"
            B[CORS]
            C[Body Parser]
            E[Multer Upload]
        end
        
        subgraph "Routes (src/.../routes)"
            G[health.js]
            H[merge.js]
            I[testMerge.js]
            J[dubbingAsync.js]
        end
        
        subgraph "Processors"
            K[dubbingProcessor.js]
        end
        
        subgraph "Merge-Only Domain Services (src/merge-only/services)"
            L[ffmpegService.js]
            M[downloadService.js]
            N[storageService.js]
            O[video.js]
            P[webhookService.js]
        end

        subgraph "Dubbing Pipeline Domain Services (src/dubbing-pipeline/services)"
            Q[audioExtractionService.js]
            R[transcriptionService.js]
            S[translationService.js]
            T[ttsService.js]
        end

        subgraph "Shared Infrastructure Services (src/shared/services)"
            U[firebaseService.js]
            V[r2Service.js]
        end
        
        subgraph "Shared Utilities (src/shared/utils)"
            W[cleanup.js]
        end
    end
    
    A --> B
    A --> C
    A --> E
    
    A --> G
    A --> H
    A --> I
    A --> J
    
    J --> U
    J --> K
    
    K --> Q
    K --> R
    K --> S
    K --> T
    K --> L
    K --> M
    K --> V
    K --> U
    
    A --> W
    W --> U
    
    style A fill:#4A90E2,color:#fff
    style K fill:#E24A4A,color:#fff
```

## FFmpeg Processing Pipeline

```mermaid
flowchart LR
    A[Video Input<br/>video.mp4] --> B[FFmpeg]
    C[Audio Input<br/>audio.mp3] --> B
    
    B --> D{Duration Check}
    D -->|Match| E[Direct Merge]
    D -->|Mismatch| F[Apply -shortest flag]
    
    E --> G[Output Processing]
    F --> G
    
    G --> H{Video Codec}
    H -->|Copy| I[No Re-encoding<br/>Fast, Quality Preserved]
    H -->|Re-encode| J[Slow, Quality Loss]
    
    G --> K{Audio Codec}
    K -->|AAC| L[Universal Compatibility]
    
    I --> M[Merged Output<br/>output.mp4]
    L --> M
    
    M --> N[Verify Output]
    N --> O{Success?}
    O -->|Yes| P[Return to Client]
    O -->|No| Q[Error Handling]
    
    style B fill:#50C878,color:#fff
    style M fill:#4A90E2,color:#fff
```

## Cleanup System

```mermaid
flowchart TB
    A[Server Startup] --> B[Start Auto-Cleanup]
    B --> C[Run Every 1 Hour]
    
    C --> D{Check temp/ Folder}
    D --> E{File Age > 24h?}
    E -->|Yes| F[Delete File]
    E -->|No| G[Keep File]
    
    C --> H{Check public/output/}
    H --> I{File Age > 24h?}
    I -->|Yes| J[Delete File]
    I -->|No| K[Keep File]
    
    F --> L[Log Deleted]
    J --> L
    
    L --> M[Wait 1 Hour]
    M --> C
    
    N[Manual Trigger<br/>npm run cleanup] -.-> D
    N -.-> H
    
    style B fill:#E24A4A,color:#fff
    style F fill:#FF6B6B,color:#fff
    style J fill:#FF6B6B,color:#fff
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        A[Local Machine]
        B[Docker Container]
    end
    
    subgraph "Version Control"
        C[GitHub Repository]
    end
    
    subgraph "CI/CD"
        D[GitHub Actions<br/>Optional]
    end
    
    subgraph "Production"
        E[Railway/Heroku<br/>Container Platform]
        F[FFmpeg Binary<br/>Pre-installed]
        G[Environment Variables]
    end
    
    subgraph "Storage Options"
        H[Local Disk<br/>Testing Only]
        I[Cloudflare R2]
        J[AWS S3]
        K[Backblaze B2]
    end
    
    subgraph "Clients"
        L[Web Browsers]
        M[Next.js App]
    end
    
    A --> C
    B --> C
    C --> D
    D --> E
    
    E --> F
    E --> G
    E --> H
    E --> I
    E --> J
    E --> K
    
    L --> E
    M --> E
    
    style E fill:#4A90E2,color:#fff
    style F fill:#50C878,color:#fff
```

## Technology Stack

```mermaid
mindmap
  root((Audio-Video<br/>Merge & Dubbing Server))
    Backend
      Node.js 20+
      Express.js 4.x
      Multer
        Multipart File Uploads
      FFmpeg
        Audio Extraction
        Audio-Video Merge
    AI Services
      AssemblyAI API
        Speech-to-Text Transcription
      DeepL API
        Text Translation
      Replicate API
        Kokoro-82M TTS
    Storage & DB
      Cloudflare R2
        S3 SDK Upload
        Permanent Cloud Storage
      Firebase Firestore
        Job State Database
      Local FileSystem
        temp/
        public/output/
    DevOps
      Docker
        Dockerfile
        docker-compose
      Environment
        .env config
        Auto-cleanup
    Testing
      Test Endpoints
        merge-one
        merge-multiple
        api/dubbing/async/*
      Web Interface
        dubbing.html
        merge.html
    Security
      CORS
      File Size Limits
```

---

## Notes

- **FFmpeg**: Core dependency for video/audio extraction and merging
- **Multer**: Handles multipart/form-data file uploads (up to 500MB per file)
- **AssemblyAI**: Used for high-quality speech-to-text transcription
- **DeepL**: Used for translation across target languages
- **Replicate & Kokoro-82M**: Generates high-quality synthetic speech dubbed tracks
- **Firebase Firestore**: Stores job states (pending -> processing -> completed/failed) and results
- **Cloudflare R2**: Used for hosting final dubbed video files publicly
- **Storage**: Automatically cleaned up (local files deleted after upload to R2, local temp files older than 24 hours deleted, and Firestore jobs older than 48 hours deleted)
