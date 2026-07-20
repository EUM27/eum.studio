# 승인 설계 기준 manifest

기준일: 2026-07-20
제품: 이음 스튜디오
현행 이주 원본: `D:\eum.editor`
새 프로젝트: `D:\eum.studio`

이 문서는 외부 설계 작업 폴더에 있는 승인 문서의 정확한 기준점을 기록한다. checksum이 달라지면 무조건 오류로 취급하지 않고, 변경 diff를 검토해 이 manifest를 명시적으로 갱신한다.

## 제품 헌법

| 문서 | SHA-256 |
|---|---|
| `C:\Users\limoj\Documents\Codex\2026-07-15\new-chat-2\eum-writer-studio-from-zero-design-2026-07-20.md` | `27E69D9B6A3CFB0EB6083FE07701782F464B42DCAFFA7FC73384024059F5767B` |

## 구현 기준 묶음

기준 폴더:

`C:\Users\limoj\Documents\Codex\2026-07-15\new-chat-2\eum-implementation-foundation-2026-07-20`

| 문서 | SHA-256 |
|---|---|
| `README.md` | `D560D9DC32C31FEE2232A2FE2C172B8EE0B52C7DA2EF645C9194E823BF31BAAE` |
| `01-glossary-and-identifiers.md` | `9C0E7DCE18C25777649E2755AFD07E4858AEA328C4862174464F7992EAD93A3A` |
| `02-domain-schema.md` | `7F2DC9CD05BC84D3AED2FF96C288FDE9E18CB10080AC878A8D822066722047A2` |
| `03-state-transitions.md` | `F734145C641486D976A738E8C9124928C67C61AD1B678464209BD74E7667ECE7` |
| `04-mvp-and-quality-boundary.md` | `332934CC0B7E6B62E0F50EAF10C4AA00D4FF92807E439CDDC739C8313BC975E4` |
| `A-anchor-remapping.md` | `252549D98BBEE089EBB59B012C28751F9AF4DC1B47BA8AEB50FE0D708BA77498` |
| `05-first-release-screen-flows.md` | `F1ED30267C0E89F46D78BD097548B6BD7B510D46DE806AD8C821F1E9C152E7C6` |
| `06-desktop-runtime-and-storage-adr.md` | `874D85C684FAE6240632AF34556328BBF3D0348A5AAF91F2F23B551E14250358` |
| `07-current-data-migration-map.md` | `92D38F32ABF5A66E146C6F70D85FE827F9B191D2B42072C72FB1B19602FE8F2D` |
| `08-foundation-poc-execution-plan.md` | `3DDBF47A361E1AFF51398CA1B7D691A8D271E32F70E83F1A614E51E3E6AC2E07` |

## 적용 우선순위

1. 제품 헌법의 소유권과 금지선
2. 구현 기준 묶음의 필드·상태·품질 계약
3. 현 Gate의 POC 계획
4. POC 측정 결과로 승인된 기술 결정
5. 구현 코드

현행 앱 코드와 레거시 문서는 새 설계보다 높은 권위를 갖지 않는다. 다만 사용자 데이터 보존, 이미 검증된 행동, 마이그레이션 입력의 근거로 사용한다.
