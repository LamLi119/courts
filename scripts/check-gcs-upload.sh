#!/usr/bin/env bash
# Quick GCS upload check on the VM (run as team user from /opt/courts-new).
set -euo pipefail

ENV_FILE="${1:-/etc/courts/staging.env}"
echo "=== GCS upload check (env: $ENV_FILE) ==="

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BUCKET="${GCS_BUCKET_NAME:-courts-image-bucket}"
echo "GCS_BUCKET_NAME=${BUCKET}"

if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  echo "GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}"
else
  echo "GOOGLE_APPLICATION_CREDENTIALS=(not set — using VM default service account or api/*.json)"
fi

SA_EMAIL="$(curl -sf -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email \
  2>/dev/null || true)"
[[ -n "$SA_EMAIL" ]] && echo "VM service account: ${SA_EMAIL}"

node --input-type=module -e "
import { Storage } from '@google-cloud/storage';
const bucket = process.env.GCS_BUCKET_NAME || 'courts-image-bucket';
const storage = new Storage();
const name = 'venues/healthcheck-' + Date.now() + '.txt';
const file = storage.bucket(bucket).file(name);
await file.save('courts-gcs-check', { contentType: 'text/plain', resumable: false });
console.log('OK: wrote gs://' + bucket + '/' + name);
"
