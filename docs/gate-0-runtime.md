# Gate 0 런타임 결정과 검증

조사일: 2026-07-20
대상: `D:\eum.studio`
상태: Gate 0 기준

## 선택한 도구

| 항목 | 고정 버전 | 선택 근거 |
|---|---:|---|
| Node | 24.13.0 | 현재 실행 환경이며 모든 직접 도구의 engine 범위와 일치 |
| Electron | 43.1.1 | 조사 시점 registry 최신, Node 22.12 이상 요구 |
| Vite | 8.1.5 | renderer 전용 production bundle |
| React | 19.2.7 | 최소 renderer shell |
| TypeScript | 6.0.3 | 현재 `typescript-eslint`의 `<6.1.0` peer 범위 안 최신 |
| Vitest | 4.1.10 | 순수 도메인·정책·경계 검증 |
| Playwright | 1.61.1 | 실제 Electron 프로세스 E2E |
| ESLint | 10.7.0 | 정적 검사 |

정확한 전체 직접 의존성은 실행 때 생성되는 `environment.json`에 기록한다. 이 표는 사용자 데이터나 제품 기능 제한이 아니다.

## 빌드 결정

Electron Forge의 Vite plugin은 공식 문서에서 실험적이며 API 안정성을 보장하지 않는다. Gate 0에서는 채택하지 않았다.

- main: TypeScript CommonJS 출력
- preload: Vite library mode로 단일 CommonJS bundle
- renderer: Vite production bundle

sandbox preload는 일반 Node preload처럼 인접 로컬 모듈을 자유롭게 `require`할 수 없다. 첫 E2E에서 `tsc`가 남긴 상대 import가 실제로 실패했기 때문에, preload와 bridge contract를 단일 파일로 묶는다.

renderer는 `file://`에서 실행하므로 Vite asset base는 상대 경로다. 개발 서버 주소나 port를 production bundle에 고정하지 않는다.

## 보안 경계

BrowserWindow:

- `sandbox: true`
- `contextIsolation: true`
- `nodeIntegration: false`
- `webSecurity: true`
- 새 window 생성 거부
- 설정된 renderer target 밖 navigation 거부

preload:

- `contextBridge`만 사용
- 범용 `send`·`invoke` 미노출
- 허용된 시스템 조회 메서드만 제공
- main 응답을 renderer 전달 전 검증

renderer:

- Electron·Node import 금지
- DB·파일·token 직접 접근 금지
- meta CSP의 실제 지원 directive만 사용

## 공식 근거

- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron Forge Vite plugin](https://www.electronforge.io/config/plugins/vite)

## 검증 표면

- 창 보안 정책 단위 테스트
- typed bridge 단위 테스트
- 계층 import 경계 테스트
- CSP 정적 테스트
- 공통 p50·p95 측정 요약 테스트
- 환경 manifest 허용 필드 테스트
- 실제 sandbox Electron 창 E2E
- console error 0 검증

환경 보고서는 전체 환경 변수를 덤프하지 않는다. OS·architecture·Node와 직접 설치 패키지 이름·버전만 whitelist로 기록한다.
