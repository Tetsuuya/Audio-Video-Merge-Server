/**
 * CLOUDFLARE R2 STORAGE SERVICE
 * Upload videos to R2 for permanent storage
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

// Configure R2 client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

/**
 * Upload video to R2
 * @param {string} filePath - Local file path
 * @param {string} key - Object key (filename in R2)
 * @returns {Promise<string>} - Public URL
 */
async function uploadVideo(filePath, key) {
  try {
    log.step(`Uploading to R2: ${path.basename(filePath)}`);
    
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const objectKey = key || fileName;
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      Body: fileContent,
      ContentType: 'video/mp4'
    });
    
    await r2Client.send(command);
    
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${objectKey}`;
    
    log.success(`R2 upload complete: ${publicUrl}`);
    
    try {
      fs.unlinkSync(filePath);
      log.info(`Local file removed: ${path.basename(filePath)}`);
    } catch (err) {
      log.warn(`Failed to delete local file: ${err.message}`);
    }
    
    return publicUrl;
    
  } catch (error) {
    log.error(`R2 upload failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  uploadVideo
};
