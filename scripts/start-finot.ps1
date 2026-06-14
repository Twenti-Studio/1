# FiNot auto-start script
# Dijalankan saat Windows logon (lewat Task Scheduler) atau manual.
# Idempotent: aman dipanggil berkali-kali.
#
# Yang dilakukan:
#   1. Tunggu Docker Desktop siap (kalau belum jalan, dia akan di-start)
#   2. docker compose up -d (start finot-db + finot-bot)
#   3. Start ngrok tunnel ke port 8002 kalau belum jalan
#   4. Tunggu webhook /health balas OK
#
# Log: %USERPROFILE%\finot-startup.log

$ErrorActionPreference = "Continue"
$ProjectDir = "c:\MyFolder\ProjekTipis\FiNot_bot"
$LogFile = "$env:USERPROFILE\finot-startup.log"
$NgrokExe = "C:\laragon\bin\ngrok\ngrok.exe"
$NgrokPort = 8002

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

# ── 3. Start ngrok kalau belum jalan ──
$ngrokRunning = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($ngrokRunning) {
    Write-Log "ngrok sudah running (PID: $($ngrokRunning.Id -join ','))."
} else {
    if (-not (Test-Path $NgrokExe)) {
        Write-Log "ERROR: ngrok tidak ditemukan di $NgrokExe"
    } else {
        Write-Log "Start ngrok tunnel ke port $NgrokPort..."
        Start-Process -FilePath $NgrokExe `
            -ArgumentList "http", "$NgrokPort", "--log=stdout" `
            -RedirectStandardOutput "$ProjectDir\.ngrok.log" `
            -WindowStyle Hidden
        Start-Sleep -Seconds 4
    }
}

# ── 4. Tunggu finot-bot healthy ──
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

# ── 5. Verifikasi tunnel ngrok ──
try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5
    $url = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    if ($url) {
        Write-Log "ngrok tunnel: $url"
    } else {
        Write-Log "PERINGATAN: ngrok API balas tapi tidak ada tunnel HTTPS."
    }
} catch {
    Write-Log "PERINGATAN: tidak bisa hubungi ngrok API: $($_.Exception.Message)"
}

Write-Log "=== FiNot startup done ==="
