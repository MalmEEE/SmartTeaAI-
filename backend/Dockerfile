FROM node:20-slim

# Install Python3 + pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install ML Python packages
RUN pip3 install --no-cache-dir --break-system-packages \
    numpy \
    pandas \
    tensorflow \
    xgboost \
    joblib \
    scikit-learn \
    python-dateutil

# Build NestJS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npm run build
RUN npm prune --omit=dev

# Copy ML engine (scripts + trained models + data)
WORKDIR /app
COPY ml-engine/ ./ml-engine/

ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_BIN=python3

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "dist/main"]
