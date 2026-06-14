# FiNot auto-start script
# Dijalankan saat Windows logon (lewat Task Scheduler) atau manual.
# Idempotent: aman dipanggil berkali-kali.
#
# Yang dilakukan:
#   1. Tunggu Docker Desktop siap (kalau belum jalan, dia akan di-start)
#   2. docker compose up -d (start finot-db + finot-bot)
#   3. Tunggu webhook /health balas OK
#
# Catatan: Public access lewat domain fi-note.app (Nginx + SSL di server),
#          BUKAN ngrok lagi. Lihat deploy.sh untuk deploy di server Linux.
#
# Log: %USERPROFILE%\finot-startup.log

$ErrorActionPreference = "Continue"
$ProjectDir = "c:\MyFolder\ProjekTipis\FiNot_bot"
$LogFile = "$env:USERPROFILE\finot-startup.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding utf8
}

Write-Log "=== FiNot startup begin ==="
Set-Location $ProjectDir

# ── 1. Pastikan Docker Desktop running ──
Write-Log "Cek Docker Desktop..."
$dockerReady = $false
for ($i = 0; $i -lt 30; $i++) {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
        break
    }
    if ($i -eq 0) {
        Write-Log "Docker belum siap. Start Docker Desktop..."
        $dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dd) {
            Start-Process $dd -WindowStyle Hidden
        } else {
            Write-Log "PERINGATAN: Docker Desktop tidak ditemukan di $dd"
        }
    }
    Start-Sleep -Seconds 5
}
if (-not $dockerReady) {
    Write-Log "ERROR: Docker tidak siap setelah 150 detik. Stop."
    exit 1
}
Write-Log "Docker ready."

# ── 2. docker compose up -d ──
Write-Log "Menjalankan docker compose up -d..."
docker compose up -d 2>&1 | ForEach-Object { Write-Log "  $_" }

# ── 3. Tunggu finot-bot healthy ──
Write-Log "Tunggu backend /health..."
$backendOk = $false
for ($i = 0; $i -lt 24; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8002/health" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) {
            $backendOk = $true
            break
        }
    } catch { }
    Start-Sleep -Seconds 5
}
if ($backendOk) {
    Write-Log "Backend /health OK."
} else {
    Write-Log "PERINGATAN: backend /health belum balas setelah 120 detik."
}

Write-Log "=== FiNot startup done ==="
