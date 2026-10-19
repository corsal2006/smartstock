# Production & Local Deployment Guide — SmartStock AI

This document provides verified operational commands for deploying, monitoring, rolling back, and maintaining SmartStock AI in both local and production environments.

---

## 1. Local Development Strategy

Local development runs via **Docker Compose** or directly using Node.js/Python local web servers.

### 1.1 Local Docker Compose (Development Mode)
In development mode, changes to `index.html` are reflected immediately inside the container without rebuilding the image:

```bash
# 1. Start dev container with live volume bind
docker compose --profile dev up -d smartstock-dev

# 2. Inspect running dev container
docker compose ps

# 3. View live logs
docker compose logs -f smartstock-dev

# 4. Stop dev container
docker compose --profile dev down
```

### 1.2 Local Docker Compose (Production Preview Mode)
To simulate the exact immutable production container locally:

```bash
# 1. Create local .env from template
cp .env.example .env

# 2. Build and start production service
docker compose up -d --build smartstock

# 3. Verify health status
curl -i http://localhost:8080/healthz

# 4. Open in browser:
#    http://localhost:8080

# 5. Stop production service
docker compose down
```

---

## 2. Production Deployment Strategy

Production deployments use versioned, immutable Docker images published to a container registry and deployed to a Docker Engine host.

### 2.1 Building & Tagging the Production Image
```bash
# Set build metadata
COMMIT_SHA=$(git rev-parse --short HEAD)
BUILD_ID="1"
IMAGE_TAG="prod-${BUILD_ID}-${COMMIT_SHA}"
REGISTRY="docker.io"
REPO="phutaneprathamesh829/smart-stock"

# Build production image
docker build -t ${REGISTRY}/${REPO}:${IMAGE_TAG} -t ${REGISTRY}/${REPO}:latest .
```

### 2.2 Pushing to Container Registry
```bash
# Authenticate with registry
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Push tagged images
docker push ${REGISTRY}/${REPO}:${IMAGE_TAG}
docker push ${REGISTRY}/${REPO}:latest
```

---

## 3. Production Deployment on Docker Host

### 3.1 Zero-Downtime Safe Deployment Command Sequence
To avoid downtime and protect existing running services, follow this verified deployment sequence:

```bash
#!/bin/bash
set -e

CONTAINER_NAME="smartstock-container"
TARGET_IMAGE="${REGISTRY}/${REPO}:${IMAGE_TAG}"
DEPLOY_PORT="8080"

echo "Deploying ${TARGET_IMAGE}..."

# 1. Pull latest image from registry
docker pull ${TARGET_IMAGE}

# 2. Tag currently running image as rollback backup (if exists)
CURRENT_RUNNING_IMAGE=$(docker inspect --format='{{.Config.Image}}' ${CONTAINER_NAME} 2>/dev/null || true)
if [ -n "$CURRENT_RUNNING_IMAGE" ]; then
    echo "Creating rollback tag from active image: ${CURRENT_RUNNING_IMAGE}"
    docker tag "$CURRENT_RUNNING_IMAGE" ${CONTAINER_NAME}:rollback
fi

# 3. Stop and remove the old container
docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true

# 4. Run the new container
docker run -d \
    --name ${CONTAINER_NAME} \
    --restart unless-stopped \
    -p ${DEPLOY_PORT}:8080 \
    -e APP_ENV=production \
    ${TARGET_IMAGE}

# 5. Verify deployment with healthcheck retry loop
echo "Verifying service health on http://localhost:${DEPLOY_PORT}/healthz..."
for i in {1..10}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEPLOY_PORT}/healthz || echo "failed")
    if [ "$STATUS" = "200" ]; then
        echo "Deployment SUCCESS! Health check passed with HTTP 200 OK."
        curl -s http://localhost:${DEPLOY_PORT}/healthz
        exit 0
    fi
    echo "Attempt $i: status is $STATUS, retrying in 2 seconds..."
    sleep 2
done

echo "CRITICAL: Health check failed! Initiating rollback..."
docker stop ${CONTAINER_NAME} || true
docker rm ${CONTAINER_NAME} || true
docker run -d --name ${CONTAINER_NAME} --restart unless-stopped -p ${DEPLOY_PORT}:8080 ${CONTAINER_NAME}:rollback
echo "Rolled back to previous image."
exit 1
```

---

## 4. Rollback Procedure

If a bug or regression is detected post-deployment:

### Automatic Rollback
Both the `Jenkinsfile` and the deployment script above automatically roll back to `${CONTAINER_NAME}:rollback` if the `/healthz` check fails.

### Manual Rollback to Specific Version
To manually roll back to a known stable image tag:

```bash
STABLE_IMAGE="docker.io/phutaneprathamesh829/smart-stock:prod-1-966c1d8"

# 1. Stop problematic container
docker stop smartstock-container

# 2. Remove container
docker rm smartstock-container

# 3. Run known stable image
docker run -d \
  --name smartstock-container \
  --restart unless-stopped \
  -p 8080:8080 \
  -e APP_ENV=production \
  ${STABLE_IMAGE}

# 4. Confirm health
curl -i http://localhost:8080/healthz
```

---

## 5. Maintenance & Pruning

To maintain server disk space without removing active volumes or unrelated images:

```bash
# Safe: Remove only dangling untagged intermediate images
docker image prune -f

# View disk space consumed by Docker
docker system df
```
