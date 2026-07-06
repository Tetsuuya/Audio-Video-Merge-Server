/**
 * WEBHOOK SERVICE
 * 
 * Purpose: Send results back to Next.js app via webhook
 * 
 * Responsibilities:
 * - Call webhookUrl with job results
 * - Include x-dubbing-secret header
 * - Handle success, failure, and partial failure cases
 * - Retry on network errors (optional)
 * 
 * Webhook payload structures:
 * 
 * SUCCESS:
 * {
 *   jobId: string,
 *   projectId: string,
 *   status: 'completed',
 *   results: {
 *     'fr-FR': 'https://storage.com/video-fr.mp4',
 *     'de-DE': 'https://storage.com/video-de.mp4'
 *   }
 * }
 * 
 * FAILURE (entire job):
 * {
 *   jobId: string,
 *   projectId: string,
 *   status: 'failed',
 *   error: 'Video download failed: 404 Not Found'
 * }
 * 
 * PARTIAL FAILURE (some tracks succeed, some fail):
 * {
 *   jobId: string,
 *   projectId: string,
 *   status: 'partial',
 *   results: {
 *     'fr-FR': 'https://storage.com/video-fr.mp4',  // success
 *     'de-DE': { error: 'ffmpeg merge failed: unsupported codec' }  // failure
 *   }
 * }
 */

const https = require('https');
const http = require('http');

/**
 * Send webhook notification
 * @param {string} webhookUrl - Webhook URL
 * @param {object} payload - Webhook payload
 * @returns {Promise<void>}
 */
async function sendWebhook(webhookUrl, payload) {
  const url = new URL(webhookUrl);
  const protocol = url.protocol === 'https:' ? https : http;
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dubbing-secret': process.env.CUSTOM_DUBBING_SECRET || ''
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✓ Webhook sent successfully (${res.statusCode})`);
          resolve();
        } else {
          console.error(`✗ Webhook failed (${res.statusCode}): ${data}`);
          reject(new Error(`Webhook failed with status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('✗ Webhook request error:', error.message);
      reject(error);
    });
    
    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Send success webhook
 * @param {string} webhookUrl - Webhook URL
 * @param {string} jobId - Job ID
 * @param {string} projectId - Project ID
 * @param {object} results - Results object { 'fr-FR': 'url', ... }
 */
async function sendSuccess(webhookUrl, jobId, projectId, results) {
  const payload = {
    jobId,
    projectId,
    status: 'completed',
    results
  };
  
  console.log('Sending success webhook:', payload);
  await sendWebhook(webhookUrl, payload);
}

/**
 * Send failure webhook
 * @param {string} webhookUrl - Webhook URL
 * @param {string} jobId - Job ID
 * @param {string} projectId - Project ID
 * @param {string} error - Error message
 */
async function sendFailure(webhookUrl, jobId, projectId, error) {
  const payload = {
    jobId,
    projectId,
    status: 'failed',
    error
  };
  
  console.log('Sending failure webhook:', payload);
  await sendWebhook(webhookUrl, payload);
}

/**
 * Send partial failure webhook
 * @param {string} webhookUrl - Webhook URL
 * @param {string} jobId - Job ID
 * @param {string} projectId - Project ID
 * @param {object} results - Mixed results { 'fr-FR': 'url', 'de-DE': { error: '...' } }
 */
async function sendPartial(webhookUrl, jobId, projectId, results) {
  const payload = {
    jobId,
    projectId,
    status: 'partial',
    results
  };
  
  console.log('Sending partial webhook:', payload);
  await sendWebhook(webhookUrl, payload);
}

module.exports = {
  sendSuccess,
  sendFailure,
  sendPartial
};
