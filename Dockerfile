# ================================
# Stage 1: Build Frontend (React + Vite)
# ================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ================================
# Stage 2: Production Backend (FastAPI + Cloud Run)
# ================================
FROM python:3.13-slim

WORKDIR /app

# Set environment variables for production
ENV PYTHONUNBUFFERED=1 \
    PORT=8080

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into backend/static for serving
COPY --from=frontend-builder /app/frontend/dist ./backend/static

WORKDIR /app/backend

# Cloud Run injects the PORT environment variable (default 8080)
EXPOSE 8080

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
