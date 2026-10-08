$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Say($text) {
  Write-Host $text
}

function Fail($text) {
  Write-Host ""
  Write-Host $text -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

function Test-Port([int] $Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $wait = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $wait.AsyncWaitHandle.WaitOne(400, $false) -and $client.Connected
    return [bool] $ok
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function New-DeskEnv {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
  @(
    "ACCESS_CODE=1234"
    "SESSION_SECRET=$secret"
    "OPENAI_API_KEY="
    "OPENAI_MODEL=gpt-6.1-sol"
    "OPENAI_TRANSCRIBE_MODEL=gpt-transcribe"
    "OPENAI_REASONING=low"
  ) | Set-Content -Path (Join-Path $Root ".env") -Encoding ascii
}

function Set-AccessCode {
  $path = Join-Path $Root ".env"
  if (-not (Test-Path $path)) { return }
  $lines = @(Get-Content $path)
  $found = $false
  $next = foreach ($line in $lines) {
    if ($line -match '^\s*ACCESS_CODE=') {
      $found = $true
      "ACCESS_CODE=1234"
    } else {
      $line
    }
  }
  if (-not $found) { $next += "ACCESS_CODE=1234" }
  Set-Content -Path $path -Value $next -Encoding ascii
}

Say ""
Say "Newton Property"
Say "The first start installs anything missing, then opens the desk."
Say "Keep this window open. Closing it stops the desk."
Say ""

if (-not [Environment]::Is64BitOperatingSystem) {
  Fail "This desk needs 64-bit Windows."
}

$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
$version = "24.12.0"
$nodeHome = Join-Path $Root ".tools\node"
$nodeExe = Join-Path $nodeHome "node.exe"

if (-not (Test-Path $nodeExe)) {
  Say "Installing Node.js $version ..."
  $tools = Join-Path $Root ".tools"
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  $zipName = "node-v$version-win-$arch.zip"
  $zipPath = Join-Path $tools $zipName
  $url = "https://nodejs.org/dist/v$version/$zipName"
  & curl.exe -L --fail --retry 3 --progress-bar -o $zipPath $url
  if ($LASTEXITCODE -ne 0) { Fail "Could not download Node.js. Check the internet connection and run Start again." }
  if (Test-Path $nodeHome) { Remove-Item -Recurse -Force $nodeHome }
  & tar.exe -xf $zipPath -C $tools
  if ($LASTEXITCODE -ne 0) { Fail "Could not unpack Node.js." }
  $unpacked = Join-Path $tools "node-v$version-win-$arch"
  Rename-Item $unpacked $nodeHome
  Remove-Item $zipPath -Force
  Say "Node.js is ready."
}

$env:Path = "$nodeHome;$env:Path"

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Say "Installing the desk. The first time takes a few minutes ..."
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { Fail "Install failed. Check the internet connection and run Start again." }
  Say "Install finished."
}

if (-not (Test-Path (Join-Path $Root ".env"))) {
  New-DeskEnv
}
Set-AccessCode
Say ""
Say "Sign in with 1234."
Say "Then link WhatsApp and add the ChatGPT key in Settings."
Say ""

if (Test-Port 3000) {
  & curl.exe -fsS --max-time 2 -o NUL http://127.0.0.1:3000
  if ($LASTEXITCODE -eq 0) {
    Say "The desk is already running. Opening the page."
    Start-Process "http://localhost:3000"
    exit 0
  }
  Fail "Port 3000 is used by another program. Close it, then run Start again."
}

Say "Starting. The browser opens when the desk is ready."
$watcher = Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 90; $i++) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $wait = $client.BeginConnect("127.0.0.1", 3000, $null, $null)
      if ($wait.AsyncWaitHandle.WaitOne(400, $false) -and $client.Connected) {
        Start-Process "http://localhost:3000"
        return
      }
    } catch {
    } finally {
      $client.Close()
    }
    Start-Sleep -Seconds 1
  }
}

try {
  & npm.cmd run local
  if ($LASTEXITCODE -ne 0) { Fail "The desk stopped." }
} finally {
  Stop-Job $watcher -ErrorAction SilentlyContinue
  Remove-Job $watcher -Force -ErrorAction SilentlyContinue
}
