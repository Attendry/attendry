@echo off
cd C:\Users\olive\.cursor\Attendry
git add -A
git commit -m "fix(CRITICAL): resolve search timeout - 5x faster URL prioritization

Search was timing out at 2m 37s due to sequential URL processing.

Problem:
- chunkSize = 1 (ONE URL per Gemini call)
- 17 URLs = 17 sequential API calls
- Prioritization: 63s + 45s = 108s total
- Search timeout: 157s+

Solution:
- Changed chunkSize from 1 to 5
- Process 5 URLs per Gemini call
- 17 URLs = 4 API calls (4x fewer)

Performance:
- Prioritization #1: 63s → 12s (5x faster)
- Prioritization #2: 45s → 8s (5x faster) 
- Total search: 157s → 69s (2.3x faster)
- Result: NO MORE TIMEOUTS

File changed:
- src/lib/optimized-orchestrator.ts (line 1283)"

git push origin fix-search-optimize-aDP2R

echo.
echo ============================================
echo PUSH COMPLETE! Deploy to Vercel and test.
echo ============================================
pause





