param(
  [Parameter(Mandatory)][string]$SourceRoot,
  [Parameter(Mandatory)][string]$TargetRoot,
  [Parameter(Mandatory)][string[]]$FileNames
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'recovery-output.ps1')
$targetDirectory = Assert-RecoveryOutputPath $TargetRoot
$sourceDirectory = [IO.Path]::GetFullPath($SourceRoot)
if ($targetDirectory.StartsWith($sourceDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Recovery target cannot be inside the source.' }
$reportPath = Assert-RecoveryOutputPath ($targetDirectory + '-files.json')
foreach ($fileName in $FileNames) {
  if ([IO.Path]::GetFileName($fileName) -ne $fileName -or $fileName -in @('.', '..')) { throw 'FileNames must contain file names only.' }
}
$sources = @($FileNames | ForEach-Object { Join-Path $SourceRoot $_ } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
if ($sources.Count -eq 0) { throw 'No selected source files were found.' }
[IO.Directory]::CreateDirectory($targetDirectory) | Out-Null
$files = foreach ($sourcePath in $sources) { Copy-RecoveryFile -SourcePath $sourcePath -TargetPath (Join-Path $targetDirectory ([IO.Path]::GetFileName($sourcePath))) }
Write-RecoveryJson -OutputPath $reportPath -Value ([ordered]@{ SourceRoot=$SourceRoot; Files=@($files) })
