/**
 * JOB TIMING & ACCURACY EVALUATOR
 * 
 * Run: node scripts/evaluateJob.js <jobId>
 */

require('dotenv').config();
const { getJob } = require('../src/shared/services/firebaseService');

async function evaluateJob(jobId) {
  if (!jobId) {
    console.log('Usage: node scripts/evaluateJob.js <jobId>');
    process.exit(1);
  }

  const job = await getJob(jobId);
  if (!job) {
    console.error(`Job "${jobId}" not found in Firestore.`);
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log(`  DUBBING EVALUATION REPORT — ${jobId}`);
  console.log('======================================================');
  console.log(`Status       : ${job.status}`);
  console.log(`Engine       : ${job.ttsEngine || 'kokoro'}`);
  console.log(`Languages    : ${job.sourceLanguage.toUpperCase()} -> [${job.targetLanguages.map(l => l.toUpperCase()).join(', ')}]`);
  console.log(`Transcript   : "${(job.transcript || '').substring(0, 80)}..."`);
  console.log('------------------------------------------------------\n');

  if (job.results) {
    for (const [lang, result] of Object.entries(job.results)) {
      console.log(`>>> TARGET LANGUAGE: [${lang.toUpperCase()}]`);
      console.log(`    Translation: "${(result.translation || '').substring(0, 90)}..."`);
      console.log(`    Video URL  : ${result.video || 'N/A'}`);

      if (result.alignment) {
        console.log(`    Timing Accuracy : ${result.alignment.timing_accuracy}`);
        console.log(`    Average Drift   : ${result.alignment.average_drift}`);
        console.log('\n    Segment-by-Segment Breakdown:');
        console.table(result.alignment.segments);
      } else {
        console.log('    No alignment metrics stored for this job (run prior to metrics upgrade).');
      }
      console.log('\n');
    }
  }

  if (job.metrics) {
    console.log('>>> PROCESSING METRICS');
    console.table(job.metrics);
  }
}

const jobIdArg = process.argv[2];
evaluateJob(jobIdArg).catch(err => {
  console.error('Evaluation failed:', err.message);
  process.exit(1);
});
