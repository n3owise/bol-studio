FROM python:3.12-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PORT=7860

# Install system dependencies: ffmpeg for media processing, nodejs & npm for canvas rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    git \
    nodejs \
    npm \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces requires running as non-root user 1000
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /app

# Install CPU Python dependencies
COPY server/requirements.txt server/requirements-cpu.txt /app/server/
RUN pip install --no-cache-dir -r /app/server/requirements-cpu.txt

# Install Node dependencies for server-side video canvas rendering
COPY package.json package-lock.json /app/
RUN npm ci --omit=dev && npm install -g tsx
RUN node --input-type=module -e "import {ensureBrowser} from '@remotion/renderer'; await ensureBrowser();"

# Copy source code
COPY . /app

# Pre-download the Roman-Hinglish model so container starts instantly
RUN python scripts/prepare-hinglish-model.py --variant swift

# Set permissions for the Hugging Face non-root user
RUN mkdir -p /app/data && chown -R user:user /app

USER user

EXPOSE 7860

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "7860"]
