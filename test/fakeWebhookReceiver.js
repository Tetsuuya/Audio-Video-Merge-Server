/**
 * FAKE WEBHOOK RECEIVER (FOR LOCAL TESTING)
 * 
 * Purpose: Simulate the Next.js app's webhook endpoint for local testing
 * 
 * This is a tiny standalone server that:
 * 1. Listens on a different port (e.g., 3001)
 * 2. Receives POST requests from the merge server
 * 3. Logs the payload to console
 * 4. Validates the payload structure
 * 
 * Used in:
 * - Step 5: Webhook call validation
 * - Step 6: Full local job testing
 * 
 * How to use:
 * 1. Run this file: node test/fakeWebhookReceiver.js
 * 2. Point merge server's webhookUrl to http://localhost:3001/webhook
 * 3. Trigger a merge job
 * 4. Check console output here to see webhook payload
 * 
 * Validation checks:
 * - x-dubbing-secret header present
 * - jobId, projectId, status fields present
 * - results object structure (for success)
 * - error field (for failure)
 */

const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

// Webhook endpoint
app.post('/webhook', (req, res) => {
  console.log('\n========================================');
  console.log('📥 WEBHOOK RECEIVED');
  console.log('========================================');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Headers:', req.headers);
  console.log('\nPayload:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Validate payload structure
  const { jobId, projectId, status, results, error } = req.body;
  
  console.log('\n--- Validation ---');
  console.log('✓ jobId:', jobId ? '✓' : '✗ MISSING');
  console.log('✓ projectId:', projectId ? '✓' : '✗ MISSING');
  console.log('✓ status:', status ? `✓ (${status})` : '✗ MISSING');
  
  if (status === 'completed') {
    console.log('✓ results:', results ? `✓ (${Object.keys(results).length} tracks)` : '✗ MISSING');
    if (results) {
      Object.keys(results).forEach(lang => {
        console.log(`  - ${lang}: ${results[lang]}`);
      });
    }
  } else if (status === 'failed') {
    console.log('✓ error:', error ? `✓ (${error})` : '✗ MISSING');
  } else if (status === 'partial') {
    console.log('✓ results (partial):', results ? '✓' : '✗ MISSING');
    if (results) {
      Object.keys(results).forEach(lang => {
        const result = results[lang];
        if (typeof result === 'string') {
          console.log(`  - ${lang}: ✓ ${result}`);
        } else if (result.error) {
          console.log(`  - ${lang}: ✗ ${result.error}`);
        }
      });
    }
  }
  
  console.log('✓ x-dubbing-secret:', req.headers['x-dubbing-secret'] ? '✓' : '✗ MISSING');
  console.log('========================================\n');
  
  // Respond to webhook
  res.status(200).json({
    status: 'received',
    message: 'Webhook processed successfully'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fake-webhook-receiver' });
});

app.listen(PORT, () => {
  console.log(`🎣 Fake webhook receiver listening on http://localhost:${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💡 Use this URL as webhookUrl in your test requests\n`);
});
