param([Parameter(Mandatory)][string]$SourceReport, [Parameter(Mandatory)][string]$TargetReport)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'recovery-output.ps1')
$sourceDirectory = (Resolve-Path -LiteralPath $SourceReport).Path
$targetDirectory = Assert-RecoveryOutputPath $TargetReport
if ($targetDirectory.StartsWith($sourceDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Recovery target cannot be inside the source.' }
$reportPath = Assert-RecoveryOutputPath ($targetDirectory + '-files.json')
$sourceFiles = @(Get-ChildItem -LiteralPath $sourceDirectory -Recurse -Force -File)
[IO.Directory]::CreateDirectory($targetDirectory) | Out-Null
$files = foreach ($sourceFile in $sourceFiles) {
  $relativePath = [IO.Path]::GetRelativePath($sourceDirectory, $sourceFile.FullName)
  $targetPath = [IO.Path]::GetFullPath((Join-Path $targetDirectory $relativePath))
  if (-not $targetPath.StartsWith($targetDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Recovery target escaped its root.' }
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($targetPath)) | Out-Null
  $record = Copy-RecoveryFile -SourcePath $sourceFile.FullName -TargetPath $targetPath
  $record | Add-Member -NotePropertyName RelativePath -NotePropertyValue $relativePath -PassThru
}
Write-RecoveryJson -OutputPath $reportPath -Value ([ordered]@{ SourceRoot=$sourceDirectory; Files=@($files) })
