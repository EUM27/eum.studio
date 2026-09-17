#define MyAppName "이음 스튜디오"
#define MyAppExeName "이음 스튜디오.exe"
#define MyAppVersion GetEnv("EUM_STUDIO_RELEASE_VERSION")
#define MySourceDir GetEnv("EUM_STUDIO_PACKAGE_ROOT")

[Setup]
AppId={{1F3E8F8D-2A72-4D1E-AB67-0A5F2AF037E7}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=EUM27
AppPublisherURL=https://github.com/EUM27/eum.studio
AppSupportURL=https://github.com/EUM27/eum.studio/issues
AppUpdatesURL=https://github.com/EUM27/eum.studio/releases
DefaultDirName={localappdata}\Programs\Eum Studio
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\out\installer
OutputBaseFilename=EumStudio-{#MyAppVersion}-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
LicenseFile=..\LICENSE
CloseApplications=yes
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "바탕 화면 바로가기 만들기"; GroupDescription: "추가 바로가기:"; Flags: unchecked

[Files]
Source: "{#MySourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{#MyAppName} 실행"; Flags: nowait postinstall skipifsilent
