$ErrorActionPreference = "Stop"

$outputPath = "D:\eum.studio\recovery\vss-c.txt"
if (Test-Path -LiteralPath $outputPath) {
  throw "VSS inventory target already exists: $outputPath"
}

$result = & vssadmin.exe list shadows /for=C: 2>&1
$exitCode = $LASTEXITCODE
$result | Set-Content -LiteralPath $outputPath -Encoding utf8

if ($exitCode -ne 0) {
  exit $exitCode
}
