$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$electronPath = Join-Path $workspaceRoot "node_modules\electron\dist\electron.exe"
$buildLogPath = Join-Path $workspaceRoot ".tmp\start-eum-studio-build.log"
$bundlePaths = @(
  (Join-Path $workspaceRoot "dist-electron\desktop\main.js"),
  (Join-Path $workspaceRoot "dist-electron\preload\index.js"),
  (Join-Path $workspaceRoot "dist-renderer\index.html")
)

if (-not (Test-Path -LiteralPath $electronPath -PathType Leaf)) {
  throw "이음 스튜디오 Electron 실행 파일을 찾지 못했습니다: $electronPath"
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class EumStudioNativeWindow
{
    private delegate bool EnumWindowsProc(IntPtr windowHandle, IntPtr state);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(
        IntPtr windowHandle,
        out uint processId
    );

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr windowHandle);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr windowHandle, int command);

    public static IntPtr FindVisibleWindow(int processId)
    {
        IntPtr match = IntPtr.Zero;
        EnumWindows((windowHandle, state) =>
        {
            uint ownerProcessId;
            GetWindowThreadProcessId(windowHandle, out ownerProcessId);
            if (ownerProcessId == processId && IsWindowVisible(windowHandle))
            {
                match = windowHandle;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return match;
    }
}
"@

function Get-EumStudioMainProcess {
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "electron.exe" -and
    $_.ExecutablePath -eq $electronPath -and
    $_.CommandLine -notlike "*--type=*" -and
    $_.CommandLine -notlike "*playwright*"
  } | Select-Object -First 1
}

function Wait-EumStudioWindow {
  param(
    [Parameter(Mandatory = $true)]
    [int] $ProcessId,
    [Parameter(Mandatory = $true)]
    [int] $TimeoutSeconds
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    $candidate = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $candidate) {
      return [IntPtr]::Zero
    }
    $windowHandle = [EumStudioNativeWindow]::FindVisibleWindow($ProcessId)
    if ($windowHandle -ne [IntPtr]::Zero) {
      return $windowHandle
    }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)

  return [EumStudioNativeWindow]::FindVisibleWindow($ProcessId)
}

function Show-EumStudioWindow {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr] $WindowHandle
  )

  [EumStudioNativeWindow]::ShowWindowAsync(
    $WindowHandle,
    9
  ) | Out-Null
  [EumStudioNativeWindow]::SetForegroundWindow(
    $WindowHandle
  ) | Out-Null
}

function Show-EumStudioLaunchError {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Message
  )

  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    $Message,
    "이음 스튜디오",
    [System.Windows.MessageBoxButton]::OK,
    [System.Windows.MessageBoxImage]::Error
  ) | Out-Null
}

function Test-EumStudioBundleStale {
  if ($bundlePaths.Where({ -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count -gt 0) {
    return $true
  }

  $inputFiles = @(
    Get-ChildItem -LiteralPath (Join-Path $workspaceRoot "src") -Recurse -File
    Get-ChildItem -LiteralPath (Join-Path $workspaceRoot "config") -Recurse -File
    Get-Item -LiteralPath (
      Join-Path $workspaceRoot "package.json"
    ), (
      Join-Path $workspaceRoot "package-lock.json"
    ), (
      Join-Path $workspaceRoot "index.html"
    ), (
      Join-Path $workspaceRoot "tsconfig.base.json"
    ), (
      Join-Path $workspaceRoot "tsconfig.electron.json"
    ), (
      Join-Path $workspaceRoot "tsconfig.preload.json"
    ), (
      Join-Path $workspaceRoot "tsconfig.renderer.json"
    ), (
      Join-Path $workspaceRoot "vite.config.ts"
    ), (
      Join-Path $workspaceRoot "vite.preload.config.ts"
    )
  )
  $latestInput = $inputFiles |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  $oldestBundle = $bundlePaths |
    ForEach-Object { Get-Item -LiteralPath $_ } |
    Sort-Object LastWriteTimeUtc |
    Select-Object -First 1

  return $latestInput.LastWriteTimeUtc -gt $oldestBundle.LastWriteTimeUtc
}

$runningMain = Get-EumStudioMainProcess

if ($null -ne $runningMain) {
  $runningWindowHandle = Wait-EumStudioWindow `
    -ProcessId $runningMain.ProcessId `
    -TimeoutSeconds 30
  if ($runningWindowHandle -ne [IntPtr]::Zero) {
    Show-EumStudioWindow -WindowHandle $runningWindowHandle
    exit 0
  }
  $runningProcess = Get-Process `
    -Id $runningMain.ProcessId `
    -ErrorAction SilentlyContinue
  if ($null -ne $runningProcess) {
    Stop-Process -Id $runningProcess.Id -Force
    Wait-Process -Id $runningProcess.Id -Timeout 5 -ErrorAction SilentlyContinue
  }
}

if (Test-EumStudioBundleStale) {
  $logDirectory = Split-Path -Parent $buildLogPath
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
  & $npmPath run build *> $buildLogPath
  if ($LASTEXITCODE -ne 0) {
    Show-EumStudioLaunchError -Message (
      "최신 이음 스튜디오 빌드에 실패했습니다.`n`n" +
      "로그: $buildLogPath"
    )
    exit $LASTEXITCODE
  }
}

$launchedProcess = Start-Process `
  -FilePath $electronPath `
  -ArgumentList "." `
  -WorkingDirectory $workspaceRoot `
  -PassThru
$launchedWindowHandle = Wait-EumStudioWindow `
  -ProcessId $launchedProcess.Id `
  -TimeoutSeconds 30
if ($launchedWindowHandle -ne [IntPtr]::Zero) {
  Show-EumStudioWindow -WindowHandle $launchedWindowHandle
  exit 0
}
$launchedWindow = Get-Process `
  -Id $launchedProcess.Id `
  -ErrorAction SilentlyContinue
if ($null -ne $launchedWindow) {
  Stop-Process -Id $launchedWindow.Id -Force
}
Show-EumStudioLaunchError -Message (
  "이음 스튜디오 프로세스가 창을 만들지 못했습니다.`n`n" +
  "터미널에서 npm run start를 실행해 오류를 확인해 주세요."
)
exit 1
