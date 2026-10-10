#!/usr/bin/env bash
# ==============================================================================
# Burn-Ex — Production Automated EC2 Deployment & Health Verification Script
# Executed by AWS Systems Manager (SSM) RunCommand during GitHub CD workflow
# ==============================================================================

set -euo pipefail

# Configuration Defaults
APP_DIR="/var/www/burnex"
RELEASES_DIR="${APP_DIR}/releases"
SHARED_DIR="${APP_DIR}/shared"
CURRENT_LINK="${APP_DIR}/current"
VENV_DIR="${APP_DIR}/venv"
KEEP_RELEASES=5

RELEASE_TAG="${1:-${RELEASE_TAG:-$(date +%Y%m%d%H%M%S)}}"
S3_BUCKET="${2:-${S3_BUCKET:-}}"
RELEASE_TARBALL="burnex-release-${RELEASE_TAG}.tar.gz"

echo "============================================================"
echo "[Burn-Ex Deploy] Starting Deployment for Release: ${RELEASE_TAG}"
echo "============================================================"

# 1. Ensure required base directories exist
mkdir -p "${RELEASES_DIR}" "${SHARED_DIR}" "${APP_DIR}/tmp"

# 2. Download Release Artifact from S3 if bucket specified
if [ -n "${S3_BUCKET}" ]; then
    echo "[Burn-Ex Deploy] Downloading ${RELEASE_TARBALL} from S3 bucket: ${S3_BUCKET}..."
    aws s3 cp "s3://${S3_BUCKET}/${RELEASE_TARBALL}" "${APP_DIR}/tmp/${RELEASE_TARBALL}"
fi

# 3. Create target release directory and unpack archive
TARGET_DIR="${RELEASES_DIR}/${RELEASE_TAG}"
mkdir -p "${TARGET_DIR}"

if [ -f "${APP_DIR}/tmp/${RELEASE_TARBALL}" ]; then
    echo "[Burn-Ex Deploy] Unpacking release archive..."
    tar -xzf "${APP_DIR}/tmp/${RELEASE_TARBALL}" -C "${TARGET_DIR}"
    rm -f "${APP_DIR}/tmp/${RELEASE_TARBALL}"
else
    echo "[Burn-Ex Deploy] ERROR: Release artifact ${RELEASE_TARBALL} not found!"
    exit 1
fi

# 4. Link shared production .env file
if [ -f "${SHARED_DIR}/.env" ]; then
    echo "[Burn-Ex Deploy] Symlinking shared production .env file..."
    ln -sf "${SHARED_DIR}/.env" "${TARGET_DIR}/backend/.env"
else
    echo "[Burn-Ex Deploy] WARNING: Shared .env file not found in ${SHARED_DIR}/.env!"
fi

# 5. Virtual Environment & Backend Dependency Setup
if [ ! -d "${VENV_DIR}" ]; then
    echo "[Burn-Ex Deploy] Creating Python virtual environment at ${VENV_DIR}..."
    python3 -m venv "${VENV_DIR}"
fi

echo "[Burn-Ex Deploy] Installing/updating backend Python dependencies..."
"${VENV_DIR}/bin/pip" install --quiet --upgrade pip
if [ -f "${TARGET_DIR}/backend/requirements.txt" ]; then
    "${VENV_DIR}/bin/pip" install --quiet -r "${TARGET_DIR}/backend/requirements.txt"
fi

# 6. Atomic Symlink Swap to New Release
echo "[Burn-Ex Deploy] Updating current symlink -> ${TARGET_DIR}..."
ln -sfn "${TARGET_DIR}" "${CURRENT_LINK}"

# 7. Restart Application Services
echo "[Burn-Ex Deploy] Restarting burnex-backend systemd service..."
sudo systemctl daemon-reload
sudo systemctl restart burnex-backend

echo "[Burn-Ex Deploy] Reloading Nginx web server..."
sudo systemctl reload nginx

# 8. Post-Deployment Health Check & Verification
echo "[Burn-Ex Deploy] Verifying backend health check endpoint..."
MAX_RETRIES=12
RETRY_COUNT=0
HEALTH_PASSED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health || true)
    if [ "${HTTP_STATUS}" -eq 200 ]; then
        echo "[Burn-Ex Deploy] SUCCESS: Backend health check returned 200 OK!"
        HEALTH_PASSED=true
        break
    fi
    echo "[Burn-Ex Deploy] Waiting for backend to respond... (Attempt $((RETRY_COUNT + 1))/${MAX_RETRIES})"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "${HEALTH_PASSED}" = false ]; then
    echo "[Burn-Ex Deploy] ERROR: Post-deployment health check failed after ${MAX_RETRIES} attempts!"
    echo "[Burn-Ex Deploy] Inspecting backend systemd logs..."
    sudo journalctl -u burnex-backend --no-pager -n 30
    exit 1
fi

# 9. Clean up old releases (Keep last N releases)
echo "[Burn-Ex Deploy] Pruning old releases (retaining last ${KEEP_RELEASES})..."
cd "${RELEASES_DIR}"
ls -dt */ | tail -n +$((KEEP_RELEASES + 1)) | xargs -I {} rm -rf "{}"

echo "============================================================"
echo "[Burn-Ex Deploy] Release ${RELEASE_TAG} deployed successfully!"
echo "============================================================"
