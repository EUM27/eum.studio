$ErrorActionPreference = "Stop"

$sourceRoot = "\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy6\Users\limoj\AppData\Roaming\이음 스튜디오\workspace-v1"
$targetRoot = "D:\eum.studio\recovery\vss-20260902-061930-workspace-v1"

if (Test-Path -LiteralPath $targetRoot) {
  throw "VSS workspace recovery target already exists: $targetRoot"
}

New-Item -ItemType Directory -Path $targetRoot | Out-Null

foreach ($fileName in @("workspace.sqlite3", "workspace.sqlite3-wal", "workspace.sqlite3-shm")) {
  $sourcePath = Join-Path $sourceRoot $fileName
  if (Test-Path -LiteralPath $sourcePath) {
    [System.IO.File]::Copy($sourcePath, (Join-Path $targetRoot $fileName), $false)
  }
}

icacls $targetRoot /reset /T /C | Out-Null

$files = Get-ChildItem -LiteralPath $targetRoot -File -Force |
  ForEach-Object {
    [pscustomobject]@{
      FullName = $_.FullName
      Length = $_.Length
      LastWriteTime = $_.LastWriteTime.ToString("o")
    }
  }

$files | ConvertTo-Json | Set-Content -LiteralPath "$targetRoot-files.json" -Encoding utf8
