/**
 * FIREBASE SERVICE
 * 
 * Purpose: Connect to Firestore and manage job data
 * 
 * Collections:
 * - jobs: Store dubbing job status and results
 * 
 * Job document structure:
 * {
 *   jobId: string,
 *   status: 'pending' | 'processing' | 'completed' | 'failed',
 *   videoUrl: string,
 *   sourceLanguage: string,
 *   targetLanguages: string[],
 *   results: { [lang]: { video, transcript, translation, processingTime } },
 *   error: string | null,
 *   createdAt: timestamp,
 *   updatedAt: timestamp,
 *   completedAt: timestamp | null
 * }
 */

const { initializeApp, cert, getFirestore } = require('firebase-admin/app');
const { getFirestore: getDb } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');
const log = require('../utils/logger');

// Initialize Firebase Admin - Support both file and environment variable
let serviceAccount;

if (process.env.FIREBASE_CREDENTIALS) {
  log.info('Using Firebase credentials from environment variable');
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
  const credentialsPath = path.join(process.cwd(), 'firebase-credentials.json');
  
  if (!fs.existsSync(credentialsPath)) {
    throw new Error('Firebase credentials not found. Set FIREBASE_CREDENTIALS env var or create firebase-credentials.json');
  }
  
  log.info('Using Firebase credentials from file');
  serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getDb();

/**
 * Create a new job in Firestore
 */
async function createJob(jobId, videoUrl, sourceLanguage, targetLanguages, ttsEngine = 'kokoro') {
  const { FieldValue } = require('firebase-admin/firestore');
  
  const jobData = {
    jobId,
    status: 'pending',
    videoUrl,
    sourceLanguage,
    targetLanguages,
    ttsEngine,
    results: {},
    transcript: null,
    error: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    completedAt: null
  };

  await db.collection('jobs').doc(jobId).set(jobData);
  log.success(`Job created in Firestore: ${jobId}  engine=${ttsEngine}`);
  return jobData;
}

/**
 * Update job status
 */
async function updateJobStatus(jobId, status, error = null) {
  const { FieldValue } = require('firebase-admin/firestore');
  
  const updates = {
    status,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (error) {
    updates.error = error;
  }

  if (status === 'completed' || status === 'failed') {
    updates.completedAt = FieldValue.serverTimestamp();
  }

  await db.collection('jobs').doc(jobId).update(updates);
  log.success(`Job status updated: ${jobId}  →  ${status}`);
}

/**
 * Update job current step and progress
 */
async function updateJobStep(jobId, currentStep, currentLanguage = null) {
  const { FieldValue } = require('firebase-admin/firestore');
  
  const updates = {
    currentStep,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (currentLanguage) {
    updates.currentLanguage = currentLanguage;
  }

  await db.collection('jobs').doc(jobId).update(updates);
}

/**
 * Update job results for a specific language
 */
async function updateJobResult(jobId, language, result) {
  const { FieldValue } = require('firebase-admin/firestore');
  
  await db.collection('jobs').doc(jobId).update({
    [`results.${language}`]: result,
    updatedAt: FieldValue.serverTimestamp()
  });
  log.success(`Job result saved: ${jobId}  [${language}]`);
}

/**
 * Save the raw transcript (source audio transcription) to the job document
 */
async function saveJobTranscript(jobId, transcript) {
  const { FieldValue } = require('firebase-admin/firestore');
  
  await db.collection('jobs').doc(jobId).update({
    transcript,
    updatedAt: FieldValue.serverTimestamp()
  });
  log.success(`Transcript saved for job: ${jobId}`);
}

/**
 * Get job by ID
 */
async function getJob(jobId) {
  const doc = await db.collection('jobs').doc(jobId).get();
  
  if (!doc.exists) {
    return null;
  }

  return doc.data();
}

/**
 * Delete old jobs (cleanup)
 * @param {number} maxAgeHours - Maximum age in hours
 */
async function cleanupOldJobs(maxAgeHours = 48) {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  
  const snapshot = await db.collection('jobs')
    .where('createdAt', '<', cutoffTime)
    .get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  log.success(`Cleaned up ${snapshot.size} old Firestore jobs`);
  return snapshot.size;
}

module.exports = {
  createJob,
  updateJobStatus,
  updateJobStep,
  updateJobResult,
  saveJobTranscript,
  getJob,
  cleanupOldJobs,
  db
};



