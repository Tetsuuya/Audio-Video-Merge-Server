/**
 * CLOUDFLARE R2 STORAGE SERVICE
 * Upload videos to R2 for permanent storage
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

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
    console.log('Uploading to R2:', filePath);
    
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
    
    // Construct public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${objectKey}`;
    
    console.log('Upload complete:', publicUrl);
    
    // Delete local file after upload
    try {
      fs.unlinkSync(filePath);
      console.log('Local file deleted:', filePath);
    } catch (err) {
      console.warn('Failed to delete local file:', err.message);
    }
    
    return publicUrl;
    
  } catch (error) {
    console.error('R2 upload failed:', error.message);
    throw error;
  }
}

module.exports = {
  uploadVideo
};
