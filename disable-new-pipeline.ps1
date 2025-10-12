# Disable New Event Pipeline
# This script sets the environment variable to disable the new pipeline

Write-Host "🔄 Disabling New Event Pipeline..." -ForegroundColor Yellow

# Set environment variable for current session
$env:ENABLE_NEW_PIPELINE = "false"

Write-Host "✅ ENABLE_NEW_PIPELINE=false" -ForegroundColor Yellow
Write-Host ""
Write-Host "The system will now use the enhanced orchestrator (legacy pipeline)." -ForegroundColor Yellow
Write-Host ""
Write-Host "To re-enable the new pipeline, run:" -ForegroundColor Cyan
Write-Host "  .\enable-new-pipeline.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green

# Start the development server
npm run dev
