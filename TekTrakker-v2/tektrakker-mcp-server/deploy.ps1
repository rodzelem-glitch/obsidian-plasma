Write-Host "=== Deploying TekTrakker MCP Server to Google Cloud Run ===" -ForegroundColor Cyan

# Set GCP project
gcloud config set project tektrakker

# Submit container build
Write-Host "1. Submitting container build to Google Cloud Builds..." -ForegroundColor Yellow
gcloud builds submit --tag gcr.io/tektrakker/tektrakker-mcp-server

# Deploy to Cloud Run
Write-Host "2. Deploying container to Google Cloud Run..." -ForegroundColor Yellow
gcloud run deploy tektrakker-mcp-server `
  --image gcr.io/tektrakker/tektrakker-mcp-server `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --update-env-vars FIREBASE_CONFIG_PATH=/app/firebase-service-account.json

Write-Host "=== Deployment Completed Successfully! ===" -ForegroundColor Green
