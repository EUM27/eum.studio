param(
  [Parameter(Mandatory)][string]$SourceRoot,
  [Parameter(Mandatory)][string]$OutputPath,
  [Parameter(Mandatory)][datetime]$StartTime,
  [Parameter(Mandatory)][datetime]$EndTime
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'recovery-output.ps1')
$startTimeUtc = $StartTime.ToUniversalTime()
$endTimeUtc = $EndTime.ToUniversalTime()
if ($endTimeUtc -lt $startTimeUtc) { throw 'EndTime must not precede StartTime.' }
$destination = Assert-RecoveryOutputPath $OutputPath
$files = @(Get-ChildItem -LiteralPath $SourceRoot -File -Force | Where-Object { $_.LastWriteTimeUtc -ge $startTimeUtc -and $_.LastWriteTimeUtc -le $endTimeUtc } | ForEach-Object {
  [pscustomobject]@{ FullName=$_.FullName; Name=$_.Name; Length=$_.Length; CreationTimeUtc=$_.CreationTimeUtc.ToString('o'); LastWriteTimeUtc=$_.LastWriteTimeUtc.ToString('o') }
})
Write-RecoveryJson -OutputPath $destination -Value ([ordered]@{ SourceRoot=$SourceRoot; StartTime=$StartTime.ToString('o'); EndTime=$EndTime.ToString('o'); Files=$files })
