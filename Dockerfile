FROM node:20-alpine

# Install ffmpeg and python3 (required for yt-dlp)
RUN apk add --no-cache ffmpeg python3

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
