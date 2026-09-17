param([Parameter(Mandatory)][string]$Volume, [Parameter(Mandatory)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'recovery-output.ps1')
$destination = Assert-RecoveryOutputPath $OutputPath
$result = & vssadmin.exe list shadows ('/for=' + $Volume) 2>&1
$commandExitCode = $LASTEXITCODE
Write-RecoveryJson -OutputPath $destination -Value ([ordered]@{ Volume=$Volume; ExitCode=$commandExitCode; Output=@($result | ForEach-Object { $_.ToString() }) })
if ($commandExitCode -ne 0) { exit $commandExitCode }
