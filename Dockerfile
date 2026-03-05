# ════════════════════════════════════════════════
# Stage 1: Build React frontend
# ════════════════════════════════════════════════
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# Install dependencies first (better cache)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline 2>/dev/null || npm install

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build
# Output goes to /static/landing (via vite outDir: '../static/landing')

# ════════════════════════════════════════════════
# Stage 2: Python application
# ════════════════════════════════════════════════
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ind \
    tesseract-ocr-eng \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies (for Prisma)
COPY package.json ./
RUN npm install

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Prisma schema and generate
COPY prisma ./prisma/
RUN python -m prisma generate

# Copy application code
COPY app ./app/
COPY worker ./worker/
COPY main.py ./
COPY entrypoint.sh ./

# Copy built frontend from stage 1 (AFTER app code to not be overwritten)
COPY --from=frontend-builder /static/landing ./static/landing/

# Create directories
RUN mkdir -p uploads exports

# Set entrypoint permissions
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
