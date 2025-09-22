@echo off
git add .
git commit -m "Fix critical deployment issues: Suspense boundary and TypeScript types"
git push origin main
echo "Changes committed and pushed successfully!"
pause

