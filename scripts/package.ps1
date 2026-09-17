$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -Raw (Join-Path $projectRoot 'manifest.json') | ConvertFrom-Json
$releaseDir = Join-Path $projectRoot 'releases'
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
$archivePath = Join-Path $releaseDir "CookieKeep-$($manifest.version)-Chromium.zip"
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $runtimeFiles = @((Get-Item (Join-Path $projectRoot 'manifest.json'))) + @(Get-ChildItem (Join-Path $projectRoot 'src') -Recurse -File) + @(Get-ChildItem (Join-Path $projectRoot 'icons') -Recurse -File)
    foreach ($file in ($runtimeFiles | Sort-Object FullName)) {
        $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = [DateTimeOffset]::new(2026, 9, 17, 0, 0, 0, [TimeSpan]::Zero)
        $entryStream = $entry.Open()
        try { $bytes = [System.IO.File]::ReadAllBytes($file.FullName); $entryStream.Write($bytes, 0, $bytes.Length) } finally { $entryStream.Dispose() }
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Output "Chromium ZIP: $archivePath"
