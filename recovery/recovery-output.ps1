$script:RecoveryRepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Assert-RecoveryOutputPath {
  param([Parameter(Mandatory)][string]$OutputPath)
  if (-not [IO.Path]::IsPathFullyQualified($OutputPath)) { throw 'Recovery output must be a fully qualified absolute path.' }
  $resolved = [IO.Path]::GetFullPath($OutputPath)
  if ($resolved.StartsWith('\\?\') -or $resolved.StartsWith('\\.\') -or $resolved.StartsWith('\??\')) {
    throw 'Recovery output must use a regular filesystem path, not a device namespace.'
  }
  if ($resolved -eq $script:RecoveryRepositoryRoot -or $resolved.StartsWith($script:RecoveryRepositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Recovery data must be stored outside the source repository.'
  }
  # Check existing ancestors as well as the leaf: lexical containment alone
  # does not detect a junction or symbolic link pointing into the repository.
  $ancestor = $resolved
  while (-not [string]::IsNullOrEmpty($ancestor)) {
    try {
      $attributes = [IO.File]::GetAttributes($ancestor)
      if ($attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Recovery output cannot traverse a reparse point.' }
    } catch [IO.FileNotFoundException] {
      # New output components are expected; their existing parents still need checking.
    } catch [IO.DirectoryNotFoundException] {
      # Continue upward until the first existing ancestor and the filesystem root.
    }
    $ancestor = [IO.Path]::GetDirectoryName($ancestor)
  }
  if (Test-Path -LiteralPath $resolved) { throw "Recovery output already exists: $resolved" }
  return $resolved
}

function Write-RecoveryJson {
  param([Parameter(Mandatory)][string]$OutputPath, [Parameter(Mandatory)]$Value)
  $resolved = Assert-RecoveryOutputPath $OutputPath
  $stream = [IO.File]::Open($resolved, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 8))
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally { $stream.Dispose() }
}

function Copy-RecoveryFile {
  param([Parameter(Mandatory)][string]$SourcePath, [Parameter(Mandatory)][string]$TargetPath)
  $destination = Assert-RecoveryOutputPath $TargetPath
  $source = Get-Item -LiteralPath $SourcePath
  if ($source.PSIsContainer -or ($source.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Recovery input must be a regular file.' }
  $before = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash
  [IO.File]::Copy($SourcePath, $destination, $false)
  $copied = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
  $after = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash
  if ($before -ne $copied -or $before -ne $after) { throw "Recovery bytes changed while copying: $SourcePath" }
  [IO.File]::SetLastWriteTimeUtc($destination, $source.LastWriteTimeUtc)
  return [pscustomobject]@{ FileName=$source.Name; Length=$source.Length; SHA256=$copied; LastWriteTimeUtc=$source.LastWriteTimeUtc.ToString('o') }
}
