# 복구 도구

이 폴더는 복구 스크립트만 소스 관리합니다. 원고 원문, DB와 WAL/SHM,
덤프, 원시 WER 보고서와 실사용 복구 자료는 Git에 추가하지 않습니다.
기존 자료는 SHA-256을 확인한 별도 보관본으로 보존했습니다. 과거 Git
이력은 재작성하지 않았으므로 이전 커밋에는 당시 자료가 남아 있습니다.

스크립트는 PowerShell 7에서 호출자가 지정한 원본을 읽고 **저장소 밖의 새
경로**에만 결과를 작성합니다. 기존 결과를 덮어쓰거나 원본 권한을 바꾸지
않습니다. 파일 복사 후 보관본과 원본을 다시 해시해 원본 변화도 검출합니다.

| 도구 | 필수 입력 |
|---|---|
| `copy-eum-vss-workspace.ps1` | `-SourceRoot`, `-TargetRoot`, `-FileNames` (선택한 DB와 sidecar 파일명 배열) |
| `copy-eum-wer-report.ps1` | `-SourceReport`, `-TargetReport` |
| `list-eum-vss.ps1` | `-Volume`, `-OutputPath` |
| `list-eum-wer-temp.ps1` | `-SourceRoot`, `-OutputPath`, `-StartTime`, `-EndTime` |

목적지는 필요한 사용자만 접근 가능한 별도 보관 폴더로 지정합니다.
VSS와 WER 원본 읽기에 필요한 Windows 권한은 호출자가 준비하며,
도구가 자동으로 권한을 확대하지 않습니다.
