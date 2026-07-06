# Audio-Video Merge Server - Architecture Diagram

## System Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        A[Web Browser]
        B[Next.js App]
        C[Mobile App]
    end

    subgraph "API Layer"
        D[Express Server<br/>Port 8080]
        E[Auth Middleware]
        F[File Upload<br/>Multer]
    end

    subgraph "Routes"
        G[/health]
        H[/test/merge-one]
        I[/test/merge-one-upload]
        J[/test/merge-multiple]
        K[/test/merge-multiple-upload]
        L[/merge<br/>Production]
    end

    subgraph "Services"
        M[FFmpeg Service<br/>Audio/Video Merge]
        N[Download Service<br/>Fetch Remote Files]
        O[Storage Service<br/>Local/Cloud Storage]
        P[Webhook Service<br/>Notify Completion]
        Q[Cleanup Service<br/>Delete Old Files]
    end

    subgraph "Storage"
        R[(temp/<br/>Temp Uploads)]
        S[(public/output/<br/>Merged Videos)]
        T[(storage/<br/>Future Cloud)]
    end

    subgraph "External"
        U[FFmpeg Binary]
        V[Cloud Storage<br/>S3/R2/etc]
        W[Webhook Receiver<br/>Client Server]
    end

    A --> D
    B --> D
    C --> D
    
    D --> E
    E --> F
    F --> G
    F --> H
    F --> I
    F --> J
    F --> K
    F --> L
    
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
    L --> N
    L --> P
    
    M --> U
    M --> S
    N --> R
    O --> S
    O --> V
    P --> W
    Q --> R
    Q --> S
    
    style D fill:#4A90E2,stroke:#2E5C8A,stroke-width:3px,color:#fff
    style M fill:#E24A4A,stroke:#8A2E2E,stroke-width:2px,color:#fff
    style U fill:#50C878,stroke:#2E8A4A,stroke-width:2px,color:#fff
```

## Request Flow Diagrams

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

### Production Merge Flow (Future)

```mermaid
sequenceDiagram
    participant Client as Next.js App
    participant API as Express API
    participant Auth as Auth Middleware
    participant Download as Download Service
    participant FFmpeg as FFmpeg Service
    participant Storage as Cloud Storage
    participant Webhook as Webhook Service
    participant Receiver as Client Webhook
    
    Client->>API: POST /merge<br/>x-dubbing-secret: xxx
    API->>Auth: Verify secret
    Auth-->>API: Authorized
    API-->>Client: 202 Accepted<br/>{jobId, status: "processing"}
    
    par Process in background
        API->>Download: Fetch video from URL
        API->>Download: Fetch audio files from URLs
        Download-->>API: Return local paths
        
        loop For each language
            API->>FFmpeg: Merge video + audio
            FFmpeg-->>API: Return merged file
            API->>Storage: Upload to cloud (S3/R2)
            Storage-->>API: Return public URL
        end
        
        API->>Webhook: POST to client webhook
        Webhook->>Receiver: Send results
        Note over Receiver: {jobId, status: "completed",<br/>results: [{lang, url}]}
    end
```

## Data Flow

### File Processing Flow

```mermaid
flowchart LR
    A[Upload Files] --> B[temp/ Folder]
    B --> C{File Type?}
    C -->|Video| D[Video File]
    C -->|Audio| E[Audio File]
    
    D --> F[FFmpeg Merge]
    E --> F
    
    F --> G[Merged Video]
    G --> H[public/output/]
    
    H --> I{Storage Type?}
    I -->|Local| J[Serve via Express]
    I -->|Cloud| K[Upload to S3/R2]
    
    B -.Delete after 24h.-> L[Cleanup Service]
    H -.Delete after 24h.-> L
    
    K --> M[CDN/Cloud URL]
    J --> N[http://server/output/file.mp4]
    M --> O[Client Download]
    N --> O
```

## Component Architecture

```mermaid
graph TB
    subgraph "Express Server"
        A[server.js<br/>Entry Point]
        
        subgraph "Middleware"
            B[CORS]
            C[Body Parser]
            D[Auth]
            E[Multer Upload]
        end
        
        subgraph "Routes"
            F[Health Check]
            G[Test Endpoints]
            H[Production Endpoint]
        end
        
        subgraph "Services"
            I[FFmpeg Service]
            J[Download Service]
            K[Storage Service]
            L[Webhook Service]
            M[Cleanup Service]
        end
        
        subgraph "Utils"
            N[Cleanup Utility]
        end
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    
    A --> F
    A --> G
    A --> H
    
    G --> I
    H --> I
    H --> J
    I --> K
    H --> L
    
    A --> M
    M --> N
    
    style A fill:#4A90E2,color:#fff
    style I fill:#E24A4A,color:#fff
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
  root((Audio-Video<br/>Merge Server))
    Backend
      Node.js 20+
      Express.js 5.x
      Multer
        File Uploads
      FFmpeg
        Video Processing
    Storage
      Local FileSystem
        temp/
        public/output/
      Cloud Ready
        S3
        R2
        B2
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
      Web Interface
        test.html
        simple-test.html
    Security
      Custom Secret
      CORS
      File Size Limits
```

---

## Notes

- **FFmpeg**: Core dependency for video/audio processing
- **Multer**: Handles multipart/form-data file uploads (up to 500MB per file)
- **Storage**: Currently local, designed for easy cloud migration
- **Cleanup**: Automatic deletion of files older than 24 hours
- **Scalability**: Supports batch processing of up to 50 audio tracks per request
