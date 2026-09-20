param(
    [switch]$Portable,
    [switch]$NoOpen,
    [ValidateRange(1, 65535)][int]$Port = 3210
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Test-Node([string]$Candidate) {
    if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate -PathType Leaf)) { return $false }
    try {
        & $Candidate -e 'process.exit(parseInt(process.versions.node, 10) >= 22 ? 0 : 1)' 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}
try {
    $afanNode = $null
    if (-not $Portable) {
        $foundNode = Get-Command node.exe -ErrorAction SilentlyContinue
        $candidates = @("$env:ProgramFiles\nodejs\node.exe")
        if ($foundNode) { $candidates = @($foundNode.Source) + $candidates }
        if ($env:NVM_SYMLINK) { $candidates += "$env:NVM_SYMLINK\node.exe" }
        foreach ($candidate in $candidates) {
            if (Test-Node $candidate) { $afanNode = $candidate; break }
        }
    }
    if (-not $afanNode) {
        $arch = $env:PROCESSOR_ARCHITECTURE
        if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
        switch ($arch) {
            'AMD64' { $afanArch = 'x64' }
            'ARM64' { $afanArch = 'arm64' }
            default { throw 'This launcher requires 64-bit Windows (x64 or ARM64).' }
        }
        $version = 'v24.21.0'
        $stem = "node-$version-win-$afanArch"
        $cache = Join-Path $env:LOCALAPPDATA 'afan-qisi\runtime'
        if ($env:AFAN_RUNTIME_DIR) { $cache = $env:AFAN_RUNTIME_DIR }
        $target = Join-Path $cache $stem
        $afanNode = Join-Path $target 'node.exe'
        if (-not (Test-Node $afanNode)) {
            New-Item -ItemType Directory -Force -Path $cache | Out-Null
            $temp = Join-Path $cache ([guid]::NewGuid().ToString())
            New-Item -ItemType Directory -Path $temp | Out-Null
            try {
                Write-Host 'Preparing the app runtime from nodejs.org. No administrator access is needed.'
                Write-Host 'Please wait. Your browser will open after startup.'
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                $archive = "$stem.zip"
                $archivePath = Join-Path $temp $archive
                $base = "https://nodejs.org/dist/$version"
                $ProgressPreference = 'SilentlyContinue'
                Invoke-WebRequest -UseBasicParsing -Uri "$base/$archive" -OutFile $archivePath -TimeoutSec 600
                $sumPath = Join-Path $temp 'SHASUMS256.txt'
                Invoke-WebRequest -UseBasicParsing -Uri "$base/SHASUMS256.txt" -OutFile $sumPath -TimeoutSec 60
                $pattern = '^([a-f0-9]{64})\s+' + [regex]::Escape($archive) + '$'
                $expected = $null
                foreach ($line in Get-Content -LiteralPath $sumPath) {
                    if ($line -match $pattern) { $expected = $Matches[1]; break }
                }
                $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
                if (-not $expected -or $actual -ne $expected) { throw 'Runtime checksum mismatch. Please retry.' }
                Expand-Archive -LiteralPath $archivePath -DestinationPath $temp
                $extracted = Join-Path $temp $stem
                if (-not (Test-Node (Join-Path $extracted 'node.exe'))) { throw 'Node.js cannot run on this Windows version.' }
                if (-not (Test-Node $afanNode)) {
                    if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination (Join-Path $temp 'previous-runtime') }
                    Move-Item -LiteralPath $extracted -Destination $target
                }
            } finally { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }
    Write-Host "afan-qisi | Runtime: $afanNode"
    $nodeArgs = @((Join-Path $PSScriptRoot 'afan.js'), '--port', "$Port")
    if ($NoOpen) { $nodeArgs += '--no-open' }
    & $afanNode @nodeArgs
    exit $LASTEXITCODE
} catch {
    Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Check your network connection and run start.cmd again.'
    exit 1
}
