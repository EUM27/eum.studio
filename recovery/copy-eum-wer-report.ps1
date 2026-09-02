$ErrorActionPreference = "Stop"

$sourceReport = "C:\ProgramData\Microsoft\Windows\WER\ReportArchive\Critical_이음 스튜디오.exe_41822ab831653ca340d6850cf7220f2df6abb_9ab4b467_0fb07544-c46a-4ca6-9f26-56c894464781"
$targetReport = "D:\eum.studio\recovery\wer-apphang-20260902-154728"

if (Test-Path -LiteralPath $targetReport) {
  throw "WER recovery target already exists: $targetReport"
}

Copy-Item -LiteralPath $sourceReport -Destination $targetReport -Recurse
icacls $targetReport /reset /T /C | Out-Null

$files = Get-ChildItem -LiteralPath $targetReport -Recurse -File -Force |
  ForEach-Object {
    [pscustomobject]@{
      FullName = $_.FullName
      Length = $_.Length
      LastWriteTime = $_.LastWriteTime.ToString("o")
    }
  }

$files | ConvertTo-Json | Set-Content -LiteralPath "$targetReport-files.json" -Encoding utf8
