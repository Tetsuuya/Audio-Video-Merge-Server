/**
 * AUTHENTICATION MIDDLEWARE
 * 
 * Purpose: Validate x-dubbing-secret header on production endpoints
 * 
 * Used on: POST /merge (production endpoint from Next.js app)
 * Not used on: /health, /test/* (those are public/local-only)
 * 
 * How it works:
 * 1. Extract x-dubbing-secret header from request
 * 2. Compare with CUSTOM_DUBBING_SECRET env variable
 * 3. If match: continue to route handler
 * 4. If no match: return 401 Unauthorized
 * 
 * Security:
 * - CUSTOM_DUBBING_SECRET must be same on Vercel (Next.js) and Railway (this server)
 * - Generate with: openssl rand -base64 32
 * - Never commit the secret to git
 */

module.exports = (req, res, next) => {
  const secret = req.headers['x-dubbing-secret'];
  const expectedSecret = process.env.CUSTOM_DUBBING_SECRET;

  // Allow requests if no secret is configured (local development)
  if (!expectedSecret) {
    console.warn('⚠️  CUSTOM_DUBBING_SECRET not set - auth disabled');
    return next();
  }

  // Validate secret
  if (!secret || secret !== expectedSecret) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: invalid or missing x-dubbing-secret header'
    });
  }

  next();
};
