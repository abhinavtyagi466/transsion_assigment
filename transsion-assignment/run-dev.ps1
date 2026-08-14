# run-dev.ps1 — Windows equivalent of run-dev.sh
# Starts all four local dev processes:
#   Module 1 FastAPI  → python -m uvicorn api.index:app --reload --port 8000
#   Module 1 Next.js  → npm run dev  (port 3000, rewrites /api/* → :8000)
#   Module 2 FastAPI  → python -m uvicorn api.index:app --reload --port 8001
#   Module 2 Next.js  → npm run dev  (port 3001, rewrites /api/* → :8001)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ── Load .env.local into environment for Python processes ──────────────────
function Load-EnvFile($path) {
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
                [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
            }
        }
    } else {
        Write-Host "WARNING: $path not found. Copy .env.local.example and add your GEMINI_API_KEY." -ForegroundColor Yellow
    }
}

# ── Check .env.local files ────────────────────────────────────────────────
Load-EnvFile "$RootDir\module-1-voice-interview\.env.local"
Load-EnvFile "$RootDir\module-2-sentiment-chatbot\.env.local"

# ── Start processes ───────────────────────────────────────────────────────
$jobs = @()

Write-Host "[Module 1] Starting FastAPI on http://localhost:8000" -ForegroundColor Cyan
$jobs += Start-Process -PassThru -NoNewWindow python -ArgumentList "-m", "uvicorn", "api.index:app", "--reload", "--port", "8000" -WorkingDirectory "$RootDir\module-1-voice-interview"

Write-Host "[Module 1] Starting Next.js on http://localhost:3000" -ForegroundColor Cyan
$jobs += Start-Process -PassThru -NoNewWindow npm -ArgumentList "run", "dev" -WorkingDirectory "$RootDir\module-1-voice-interview"

Write-Host "[Module 2] Starting FastAPI on http://localhost:8001" -ForegroundColor Cyan
$jobs += Start-Process -PassThru -NoNewWindow python -ArgumentList "-m", "uvicorn", "api.index:app", "--reload", "--port", "8001" -WorkingDirectory "$RootDir\module-2-sentiment-chatbot"

Write-Host "[Module 2] Starting Next.js on http://localhost:3001" -ForegroundColor Cyan
$jobs += Start-Process -PassThru -NoNewWindow npm -ArgumentList "run", "dev" -WorkingDirectory "$RootDir\module-2-sentiment-chatbot"

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "  All four processes started." -ForegroundColor Green
Write-Host ""
Write-Host "  Module 1 - Voice Interview Assistant" -ForegroundColor Cyan
Write-Host "    Frontend :  http://localhost:3000"
Write-Host "    FastAPI  :  http://localhost:8000"
Write-Host ""
Write-Host "  Module 2 - Sentiment Chatbot" -ForegroundColor Cyan
Write-Host "    Frontend :  http://localhost:3001"
Write-Host "    FastAPI  :  http://localhost:8001"
Write-Host ""
Write-Host "  Press Ctrl+C to stop all processes."
Write-Host ("=" * 60) -ForegroundColor Green

# ── Wait and cleanup ─────────────────────────────────────────────────────
try {
    # Wait indefinitely — Ctrl+C triggers the finally block
    while ($true) {
        Start-Sleep -Seconds 1
        # Check if any process exited unexpectedly
        foreach ($job in $jobs) {
            if ($job.HasExited) {
                Write-Host "Process $($job.Id) ($($job.ProcessName)) exited with code $($job.ExitCode)" -ForegroundColor Yellow
            }
        }
    }
} finally {
    Write-Host "`nStopping all processes..." -ForegroundColor Yellow
    foreach ($job in $jobs) {
        if (-not $job.HasExited) {
            Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "All stopped. Goodbye." -ForegroundColor Green
}
