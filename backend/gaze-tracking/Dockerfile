FROM python:3.11-slim

# Install system dependencies for OpenCV and MediaPipe
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p gaze_data && chmod 777 gaze_data

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the FastAPI app (use PORT env var from Render, default to 8001)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
