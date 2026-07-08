/**
 * CLOUDINARY STORAGE SERVICE
 * Upload videos to Cloudinary for permanent storage
 */

const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload video to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} publicId - Public ID for the video (optional)
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadVideo(filePath, publicId = null) {
  try {
    console.log('Uploading to Cloudinary:', filePath);
    
    const options = {
      resource_type: 'video',
      folder: 'dubbing-videos',
      use_filename: true,
      unique_filename: true
    };
    
    if (publicId) {
      options.public_id = publicId;
    }
    
    const result = await cloudinary.uploader.upload(filePath, options);
    
    console.log('Upload complete:', result.secure_url);
    
    // Delete local file after upload
    try {
      fs.unlinkSync(filePath);
      console.log('Local file deleted:', filePath);
    } catch (err) {
      console.warn('Failed to delete local file:', err.message);
    }
    
    return result.secure_url;
    
  } catch (error) {
    console.error('Cloudinary upload failed:', error.message);
    throw error;
  }
}

/**
 * Delete video from Cloudinary
 * @param {string} publicId - Public ID of the video
 * @returns {Promise<object>} - Deletion result
 */
async function deleteVideo(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video'
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete failed:', error.message);
    throw error;
  }
}

module.exports = {
  uploadVideo,
  deleteVideo
};
