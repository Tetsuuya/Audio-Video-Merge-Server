# MISSION BRIEF — EXTERNAL DEVELOPER

## Audio/Video Merge Server

**Project:** a standalone server that receives one video and one or several already-dubbed audio tracks, and produces one finished video per audio track — integrated with the existing Next.js app on Vercel.

**Deployment target:** Railway (standalone server), code hosted on GitHub.

---

## Scope note — what this brief covers

This server does **NOT** do transcription, translation, or text-to-speech.

The audio files (one per target language) already exist and are provided as input.

The only job here is the assembly step: merge audio onto video, store the result, report the download URL back.

Use ffmpeg (or any A/V library the developer is comfortable with) to do the merge.

---

# 1 Goal

Build a standalone server (deployed on Railway) that:

- Receives a job from our Next.js app: one video + one or more audio files, each tagged with a language/label.
- For each audio file, produces a new video = original video + that audio track.
- Saves each resulting video somewhere downloadable — for testing, local disk or a free/temporary storage service is fine. The developer chooses the approach and flags it for review.
- Reports back via webhook with one download URL per audio track processed.

The server is decoupled from our main app: it never touches our database directly. It only talks to our app through one incoming request (job creation) and one or more outgoing webhook calls (progress/results).

---

# 2 How the server works (high-level flow)

```text
[Next.js app] --POST /merge--> [Railway server]
                                   |
                                   |  1. Download the video (videoUrl)
                                   |  2. Download each audio file (audioUrl per entry)
                                   |  3. For each audio file:
                                   |       - merge/replace audio track with it (ffmpeg)
                                   |       - save the resulting video (storage of dev's choice)
                                   |       - upload / expose it at a downloadable URL
                                   |
[Next.js app] <--POST webhookUrl-- [Railway server]
      (one payload once all audio tracks are processed, one URL per track)
```

The server should treat each job as a background task: respond quickly to the initial POST (e.g. **202 Accepted** with the `jobId`), then process asynchronously and call the webhook when done or on failure.

---

## Request the server receives (from our app)

**POST**

```
<RAILWAY_SERVER_URL>/merge
```

Headers:

```
Content-Type: application/json
x-dubbing-secret: <CUSTOM_DUBBING_SECRET>
```

Body:

```json
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "videoUrl": "https://your-r2-bucket.com/video.mp4",
  "audioTracks": [
    {
      "language": "fr-FR",
      "audioUrl": "https://.../audio-fr.mp3"
    },
    {
      "language": "de-DE",
      "audioUrl": "https://.../audio-de.mp3"
    },
    {
      "language": "es-ES",
      "audioUrl": "https://.../audio-es.mp3"
    }
  ],
  "webhookUrl": "https://your-vercel-app.vercel.app/api/webhook/custom-dubbing"
}
```

`audioTracks` can have one entry or many — the server should handle both a single track and a batch the same way (loop).

---

## Webhook the server sends back (to our app)

**POST**

```
<webhookUrl>
```

Headers:

```
Content-Type: application/json
x-dubbing-secret: <CUSTOM_DUBBING_SECRET>
```

### Success

```json
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "status": "completed",
  "results": {
    "fr-FR": "https://your-storage.com/video-fr.mp4",
    "de-DE": "https://your-storage.com/video-de.mp4",
    "es-ES": "https://your-storage.com/video-es.mp4"
  }
}
```

### Failure (whole job)

```json
{
  "jobId": "abc123",
  "projectId": "proj_xyz",
  "status": "failed",
  "error": "ffmpeg merge failed for de-DE: unsupported codec"
}
```

### Partial failure

Partial failure (some tracks succeed, one fails): flag this case explicitly and propose a payload shape (e.g. a per-track status/error inside `results`) rather than failing the whole job if 2 out of 3 tracks succeeded.

Raise this before building it.

On our side, when this webhook arrives we validate the secret, look up the job, and update its status — already built.

No need to touch our app's code, just match this contract.

---

## To decide before building — audio/video duration mismatch

A dubbed audio track is rarely the exact same duration as the source video.

Pick one rule and apply it consistently:

- (a) trim/pad the audio to the video's exact length
- (b) time-stretch the audio slightly with ffmpeg's `atempo` to fit the video exactly
- (c) freeze the last frame to extend the video to match a longer audio track

Confirm the choice with us before coding this part.

---

# 3 Why we test locally first

We don't want the first real test to happen against production data, a live Vercel deployment, and real client videos.

We validate the merge step locally, with fake/prefabricated inputs, before wiring it to the real app and before deploying anywhere.

Build a small local HTML test page (a simple static page, no framework needed) to trigger the merge by hand and confirm outputs before deployment.

---

# 4 Local testing plan — step by step

Get this fully working in local first.

Only once it works end-to-end locally should deployment to Railway be considered.

Don't move to the next step until the previous one is validated.

## Push to GitHub at every step

Commit and push each working step to GitHub as you go — don't wait until the end.

Small, working commits per step make it much easier to review progress and roll back if something breaks.

---

## Step 0 — Local project setup

- Server runs locally on a fixed port (e.g. `http://localhost:8080`)
- `.env.local` file with placeholder/test values
- A `/health` endpoint returning **200 OK** — first sanity check
- Init the GitHub repo now; first commit = this skeleton

---

## Step 1 — Local HTML test page (skeleton)

- A single static `test.html` page: pick a local video, pick one or more local audio files, hit the server, display raw JSON
- No auth, no styling requirements — a debug tool, not a UI
- Commit once it can hit `/health` successfully

---

## Step 2 — Single audio + video merge

- Endpoint (e.g. `POST /test/merge-one`) that takes one local sample video and one local sample audio file, runs the ffmpeg merge, returns/saves the result
- Validate:
  - output plays correctly
  - correct audio track
  - quality preserved
  - audio/video stay in sync
- Commit, with a short note on the exact ffmpeg command/flags used

---

## Step 3 — Multiple audio tracks, one video

- Loop over 2–3 sample audio files against the same sample video, producing one output per audio file
- Validate:
  - no filename collisions
  - clean temp file handling
- Commit

---

## Step 4 — Local storage / temporary hosting

- Save each output somewhere downloadable via URL — developer's choice for testing (static folder, free-tier host, etc.)
- Flag the choice to us — we'll decide together if it's fine to keep for a first production pass, or needs to be our R2 bucket before going live
- Commit

---

## Step 5 — Webhook call

- Point the server at a local fake webhook receiver (a tiny endpoint that logs whatever it receives)
- Trigger a full local job (one video, 2–3 audio tracks) and confirm the webhook payload matches the contract exactly
- Commit

---

## Step 6 — Full local job via the real `/merge` endpoint

- Test the actual `POST /merge` endpoint using local sample `videoUrl`/`audioUrl` values and the local fake webhook from Step 5
- Last local checkpoint before deployment — if this works, the contract is proven end-to-end
- Commit — this is the version to deploy from

---

# 5 Deployment to Railway (only after Step 6 passes locally)

- Make sure everything is pushed to GitHub
- Connect the GitHub repo to Railway, deploy from there
- Set production environment variables on Railway (see table below)
- Update `CUSTOM_DUBBING_SERVER_URL` on our Vercel project to point to the new Railway URL
- Run one real test job end-to-end before considering it live
- Commit/tag this as the deployed version

Nothing in the code should need to change between local and Railway — only the environment variables.

If anything is hardcoded (URLs, ports, secrets, file paths), flag it so it's fixed before deployment.

---

# 6 Environment variables

| Variable | Where | Local test value | Production value |
|----------|-------|------------------|------------------|
| `CUSTOM_DUBBING_SERVER_URL` | Vercel | `http://localhost:8080/merge` | `https://your-server.railway.app/merge` |
| `CUSTOM_DUBBING_SECRET` | Vercel + Railway | any test string, same both sides | `openssl rand -base64 32`, same both sides |
| Storage provider keys | Railway | free-tier keys if applicable | à vérifier — confirm final storage choice before production |

---

# 7 What we need from the developer at each checkpoint

- A short message or Loom when each step passes, with the actual output (merged video or webhook payload) for a sanity check
- Push to GitHub at every step, not just at the end
- Flag immediately any gap in the contract (e.g. the partial-failure case) — adjust the contract before building further on top of it
- Flag the storage choice for Step 4 explicitly, so we confirm whether it's acceptable or needs to be swapped before production
- Keep the local HTML test page in the repo even after deployment — useful for debugging production by pointing it at the Railway URL

---

# 8 Out of scope for this brief

- Transcription, translation, or text-to-speech — audio arrives already generated
- Any changes to the Next.js app's code or database logic
- UI/UX polish on the local test page — functional only
- Long-term/permanent storage architecture decisions — flag test-phase choice, decide production storage together
- Billing/rate-limiting on any storage provider picked — flag if limits are hit, handled separately

---

*i-avantage — custom dubbing pipeline — internal mission brief*