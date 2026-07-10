# Vast.AI Implementation Plan

**Date:** July 10, 2026  
**Goal:** Self-host Whisper and Kokoro TTS on Vast.AI GPU to achieve ~60-90 second processing times

---

## Current vs Target Architecture

### Current (4 minutes)
```
Video → AssemblyAI (3 min) → DeepL (1s) → Replicate (30s) → Merge (5s) → R2
```

### Target with Vast.AI (60-90 seconds)
```
Video → Whisper GPU (20s) → DeepL (1s) → Kokoro GPU (20s) → Merge (5s) → R2
```

---

## Phase 1: Research & Setup (Week 1)

### 1.1 Vast.AI Account Setup
- [ ] Create Vast.AI account
- [ ] Add payment method
- [ ] Test GPU instance rental (RTX 3090 or A4000)
- [ ] Verify SSH access and port forwarding

### 1.2 Model Research
- [ ] Download Whisper Large-v3 model (~3GB)
- [ ] Download Kokoro-82M model (~500MB)
- [ ] Test models locally first (validate they work)
- [ ] Document model memory requirements

### 1.3 Docker Setup
- [ ] Create Dockerfile with:
  - Python 3.10+
  - PyTorch with CUDA support
  - Whisper dependencies
  - Kokoro TTS dependencies
  - FFmpeg
- [ ] Test Docker build locally
- [ ] Push to Docker Hub

**Deliverable:** Working Docker image with both models

---

## Phase 2: GPU Deployment (Week 2)

### 2.1 Deploy to Vast.AI
- [ ] Rent GPU instance ($0.20-0.50/hour)
- [ ] Deploy Docker container
- [ ] Load models into GPU memory
- [ ] Verify CUDA is working
- [ ] Run test transcription + TTS

### 2.2 Create API Wrapper
- [ ] Build FastAPI or Express server on GPU instance
- [ ] Endpoints:
  - `POST /transcribe` - Whisper transcription
  - `POST /tts` - Kokoro speech generation
- [ ] Add authentication (API key)
- [ ] Test API calls from local machine

**Deliverable:** GPU server with REST API

---

## Phase 3: Integration (Week 3)

### 3.1 Update Backend Code
- [ ] Create new service: `src/dubbing-pipeline/services/vastAiService.js`
- [ ] Replace AssemblyAI calls with Vast.AI Whisper
- [ ] Replace Replicate TTS calls with Vast.AI Kokoro
- [ ] Keep DeepL for translation (still fastest)
- [ ] Add error handling and fallbacks

### 3.2 Environment Variables
```env
VAST_AI_API_URL=https://your-gpu-instance.vast.ai
VAST_AI_API_KEY=your-secret-key
VAST_AI_ENABLED=true  # Feature flag to toggle
```

### 3.3 Dual Mode Support
- [ ] Add feature flag to toggle between APIs and Vast.AI
- [ ] Allow graceful fallback if GPU is down
- [ ] Monitor both paths in production

**Deliverable:** Backend supports both API mode and Vast.AI mode

---

## Phase 4: Optimization (Week 4)

### 4.1 Performance Tuning
- [ ] Batch processing for multiple videos
- [ ] Keep models loaded in memory (avoid reload)
- [ ] Optimize CUDA memory usage
- [ ] Test concurrent requests

### 4.2 Cost Optimization
- [ ] Implement on-demand GPU spin-up/down
- [ ] Auto-shutdown after 10 min idle
- [ ] Monitor GPU utilization
- [ ] Calculate break-even volume

### 4.3 Monitoring
- [ ] Add logging for GPU processing times
- [ ] Alert if GPU instance goes down
- [ ] Track cost per video
- [ ] Compare speed metrics vs API mode

**Deliverable:** Optimized, cost-efficient GPU setup

---

## Technical Requirements

### GPU Specs Needed
- **Minimum:** RTX 3090 (24GB VRAM)
- **Recommended:** A4000 or A5000
- **RAM:** 32GB+
- **Storage:** 50GB for models + temp files

### Software Stack
```
Docker Container:
├── Ubuntu 22.04
├── Python 3.10
├── PyTorch 2.0+ with CUDA 11.8
├── Whisper (openai-whisper)
├── Kokoro TTS
├── FFmpeg
└── FastAPI (API server)
```

### Network Requirements
- Public IP or ngrok tunnel
- Open ports for API access
- Stable connection (GPU rental can drop)

---

## Cost Analysis

### Scenario A: 24/7 GPU ($0.30/hour)
- Monthly cost: $216
- Break-even: ~1,500 videos/month
- Use case: High consistent volume

### Scenario B: On-Demand GPU
- Spin up only when processing
- Cost: ~$0.005/video (20 sec @ $0.30/hour)
- Break-even: 300 videos/month
- Use case: Variable volume

### Scenario C: Keep Using APIs
- Current cost: ~$0.045/video
- No setup complexity
- Use case: Low volume (<300 videos/month)

---

## Risks & Mitigation

### Risk 1: GPU Instance Downtime
**Mitigation:** 
- Keep API fallback active
- Monitor GPU health
- Auto-restart on failure

### Risk 2: Setup Complexity
**Mitigation:**
- Document everything
- Test thoroughly before production
- Allocate 4 weeks for implementation

### Risk 3: Cost Overruns
**Mitigation:**
- Start with on-demand approach
- Set spending alerts
- Monitor usage daily

### Risk 4: Model Updates
**Mitigation:**
- Version control models
- Test updates before deploying
- Keep old versions as backup

---

## Decision Points

### ✅ Proceed with Vast.AI if:
- Processing 1,000+ videos/month consistently
- Need <90 second processing times
- Have DevOps resources (1 dev for 4 weeks)
- Budget for $200-500/month GPU costs

### ❌ Don't proceed if:
- Volume <300 videos/month
- 4 minutes is acceptable with async
- No DevOps capacity
- Want to focus on product features

---

## Alternative: Hybrid Approach

Start small, scale up:

**Phase 1:** Keep current API setup (4 min, cheap)  
**Phase 2:** Add ElevenLabs as optional fast mode (1 min, $0.15/min)  
**Phase 3:** Move to Vast.AI only if volume justifies it

This reduces risk and upfront investment.

---

## Timeline Summary

| Phase | Duration | Effort | Outcome |
|-------|----------|--------|---------|
| Research & Setup | 1 week | 40 hours | Docker image ready |
| GPU Deployment | 1 week | 40 hours | API working on GPU |
| Integration | 1 week | 40 hours | Backend integrated |
| Optimization | 1 week | 40 hours | Production-ready |
| **Total** | **4 weeks** | **160 hours** | **60-90 sec processing** |

---

## Recommendation

**For now:** Push current async code (works, reliable, cheap)

**Next step:** Test ElevenLabs API (2 days of work, low risk)

**Later:** Implement Vast.AI only if:
- ElevenLabs costs become prohibitive
- Volume exceeds 1,000 videos/month
- Have budget for dedicated DevOps work

---

## Resources

- Vast.AI: https://vast.ai
- Whisper: https://github.com/openai/whisper
- Kokoro TTS: https://huggingface.co/hexgrad/Kokoro-82M
- Alternative GPU rentals: RunPod, Lambda Labs, Paperspace

---

**Status:** Planning phase  
**Owner:** [Your name]  
**Last Updated:** July 10, 2026
