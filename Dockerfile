# syntax=docker/dockerfile:1.7
# CPU-only base for Cloud Run compatibility. VoxCPM will run on CPU (slower but deployable).
FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install system dependencies (ffmpeg for audio processing, build tools for compiling Python packages).
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    build-essential \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/* \
    && python -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# Copy dependency definition first to leverage build cache.
COPY services/voxcpm/requirements.txt ./requirements.txt

# Install Python dependencies for VoxCPM service (update requirements.txt as the project evolves).
RUN if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt; \
    fi

# Copy VoxCPM service code into the image.
COPY services/voxcpm /app

# Expose the port that the FastAPI/ASGI app will serve on.
EXPOSE 8080

# Default command; adjust if you change the entrypoint module.
CMD ["uvicorn", "voxcpm_service.app:app", "--host", "0.0.0.0", "--port", "8080"]
