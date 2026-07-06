/**
 * STORAGE SERVICE
 * 
 * Purpose: Handle file storage and generate download URLs for merged videos
 * 
 * Responsibilities:
 * - Save merged video files to storage
 * - Generate publicly accessible download URLs
 * - Clean up temporary files
 * 
 * Storage options (to be decided - Step 4):
 * 
 * Option A: Local disk + static serving
 * - Save to public/output/ folder
 * - Serve via express.static
 * - URL: http://localhost:8080/output/video-fr.mp4
 * - Pros: Simple, no external dependencies
 * - Cons: Files lost on Railway restart, not scalable
 * 
 * Option B: Free tier cloud storage
 * - Cloudinary, ImgBB, file.io, etc.
 * - Pros: Persistent, downloadable URLs
 * - Cons: Rate limits, may need account
 * 
 * Option C: Cloudflare R2 (same as Next.js app uses)
 * - Consistent with main app
 * - Requires R2 credentials
 * - Pros: Production-ready, permanent storage
 * - Cons: Needs configuration
 * 
 * Current implementation: Local disk (for testing)
 * Flag this choice before production deployment
 * 
 * Functions:
 * - saveVideo(filePath, language) -> downloadUrl
 * - cleanup(filePath) -> void
 */

const fs = require('fs');
const path = require('path');

/**
 * Save merged video and return download URL
 * @param {string} filePath - Path to merged video file
 * @param {string} language - Language code (e.g., 'fr-FR')
 * @returns {string} - Download URL
 */
async function saveVideo(filePath, language) {
  // TODO: Implement storage logic
  // For now, return a placeholder URL
  const filename = `video-${language}-${Date.now()}.mp4`;
  const publicPath = path.join(__dirname, '../../public/output', filename);
  
  // Copy file to public directory
  // fs.copyFileSync(filePath, publicPath);
  
  // Return download URL
  const downloadUrl = `${process.env.SERVER_URL || 'http://localhost:8080'}/output/${filename}`;
  return downloadUrl;
}

/**
 * Clean up temporary files
 * @param {string} filePath - Path to file to delete
 */
function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup ${filePath}:`, error.message);
  }
}

module.exports = {
  saveVideo,
  cleanup
};
