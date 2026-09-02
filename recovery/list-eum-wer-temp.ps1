$ErrorActionPreference = "Stop"

$sourceRoot = "C:\ProgramData\Microsoft\Windows\WER\Temp"
$outputPath = "D:\eum.studio\recovery\wer-temp-20260902-1540-1555.json"
$startTime = [datetime]"2026-09-02T15:40:00"
$endTime = [datetime]"2026-09-02T15:55:00"

if (Test-Path -LiteralPath $outputPath) {
  throw "WER temp inventory target already exists: $outputPath"
}

$files = Get-ChildItem -LiteralPath $sourceRoot -File -Force |
  Where-Object {
    $_.LastWriteTime -ge $startTime -and $_.LastWriteTime -le $endTime
  } |
  ForEach-Object {
    [pscustomobject]@{
      FullName = $_.FullName
      Name = $_.Name
      Length = $_.Length
      CreationTime = $_.CreationTime.ToString("o")
      LastWriteTime = $_.LastWriteTime.ToString("o")
    }
  }

$files | ConvertTo-Json | Set-Content -LiteralPath $outputPath -Encoding utf8
