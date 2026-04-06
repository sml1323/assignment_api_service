# Stage 1: Frontend build
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend + serve frontend
FROM python:3.12-slim
WORKDIR /app

# System deps for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev libfreetype6-dev && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# SDK
COPY bookprintapi-python-sdk/ ./bookprintapi-python-sdk/
RUN pip install --no-cache-dir -e bookprintapi-python-sdk

# Backend code
COPY backend/ ./backend/

# Dummy data images
COPY dummy-data/ ./dummy-data/

# Frontend build from stage 1
COPY --from=frontend /app/frontend/dist ./frontend/dist

# .env.example as fallback
COPY .env.example ./.env.example

EXPOSE 8000

# Seed + run
CMD ["sh", "-c", "python -m backend.app.seed 2>/dev/null; uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]
