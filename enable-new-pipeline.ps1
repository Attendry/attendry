# Enable New Event Pipeline
# This script sets the environment variable to enable the new pipeline

Write-Host "🚀 Enabling New Event Pipeline..." -ForegroundColor Green

# Set environment variable for current session
$env:ENABLE_NEW_PIPELINE = "true"

Write-Host "✅ ENABLE_NEW_PIPELINE=true" -ForegroundColor Green
Write-Host ""
Write-Host "The new event pipeline is now enabled!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test endpoints available:" -ForegroundColor Cyan
Write-Host "  • GET /api/debug/test-new-pipeline" -ForegroundColor White
Write-Host "  • GET /api/debug/test-phase2-pipeline" -ForegroundColor White  
Write-Host "  • GET /api/debug/test-phase3-pipeline" -ForegroundColor White
Write-Host ""
Write-Host "Main API endpoint:" -ForegroundColor Cyan
Write-Host "  • POST /api/events/run" -ForegroundColor White
Write-Host ""
Write-Host "To disable the new pipeline, set:" -ForegroundColor Yellow
Write-Host "  ENABLE_NEW_PIPELINE=false" -ForegroundColor White
Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green

# Start the development server
npm run dev
