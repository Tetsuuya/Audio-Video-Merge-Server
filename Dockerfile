FROM node:20-alpine

# Install ffmpeg, python3, py3-pip and official latest yt-dlp CLI
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip install --no-cache-dir --break-system-packages -U yt-dlp

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
