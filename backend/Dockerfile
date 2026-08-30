# ── Stage 1: Python venv with ML packages ─────────────────────────────
FROM python:3.11-slim AS python-deps

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir \
    numpy \
    pandas \
    tensorflow \
    xgboost \
    joblib \
    scikit-learn \
    python-dateutil

# ── Stage 2: Build NestJS ─────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app/backend
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 3: Production runtime ───────────────────────────────────────
FROM node:20-slim

# Python runtime (just the interpreter — venv has all packages)
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python venv from stage 1
COPY --from=python-deps /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy compiled backend
WORKDIR /app
COPY --from=builder /app/backend/dist      ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/package.json

# Copy ML engine (scripts + trained models + processed data)
COPY ml-engine/ ./ml-engine/

ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_BIN=/opt/venv/bin/python3

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "dist/main"]
