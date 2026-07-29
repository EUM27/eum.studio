# POC-2 저장 문자열과 ChangeBatch v1

상태: POC-2 진행 중

허용 범위: 계약·검증용 POC 데이터

실사용 원고 저장: `NO-GO`

이 문서는 append-only journal 구현 전에 고정한 저장 문자열 표현과 `ChangeBatch` v1 계약을 기록한다. journal framing·checksum algorithm·durable acknowledgement·replay·crash recovery는 아직 구현하지 않았다.

## 저장 문자열 표현 v1

| 필드 | 값 | 의미 |
|---|---|---|
| `schemaVersion` | `1` | 이 표현 계약의 버전 |
| `offsetUnit` | `utf-16-code-unit` | CodeMirror 범위와 revision 길이의 좌표 단위 |
| `lineEnding` | `lf` | durable 경계 안의 유일한 줄바꿈 |
| `unicodeNormalization` | `none` | NFC·NFD 등 Unicode normalization을 적용하지 않음 |
| `hashAndAnchorInputEncoding` | `utf-16le` | canonical 문자열의 code unit을 hash·Anchor 검증 입력 bytes로 만드는 방식 |

운영체제·파일 입력의 CRLF/CR 변환은 `ChangeBatch` 생성 전 platform adapter 경계가 소유한다. application의 durable parser는 `\r`을 발견하면 거부하며 원고를 조용히 바꾸지 않는다.

`encodeDurableText`는 LF-only 문자열의 각 UTF-16 code unit을 low byte, high byte 순서로 기록한다. 이 bytes는 본문 hash와 Anchor 검증 입력 계약이다. append-only journal record checksum은 record framing 전체를 보호하는 별도 계약이며 다음 검증 단위에서 정한다.

## ChangeBatch v1

| 필드 | 계약 |
|---|---|
| `schemaVersion` | 정확히 `1` |
| `textRepresentation` | 위 저장 문자열 표현 v1과 정확히 일치 |
| `batchId` | 호출자가 생성한 비어 있지 않은 불투명 identity |
| `workId` | 대상 작품 identity |
| `documentId` | 대상 문서 identity |
| `baseRevisionId` | 변경 좌표가 해석되는 현재 durable revision identity |
| `sequence` | journal이 연속성을 판정할 비음수 safe integer |
| `createdAt` | timezone을 포함한 절대 시각이며 parser가 UTC ISO instant로 canonicalize |
| `beforeTextLengthUtf16` | base revision의 UTF-16 code unit 길이 |
| `afterTextLengthUtf16` | 모든 변경을 적용한 결과의 UTF-16 code unit 길이 |
| `changes` | base revision 좌표의 순서 있는 비어 있지 않은 변경 목록 |

각 변경은 `fromUtf16`, `toUtf16`, `insertedText`를 가진다.

- 범위와 길이, sequence는 비음수 safe integer여야 한다.
- `fromUtf16 <= toUtf16 <= beforeTextLengthUtf16`이어야 한다.
- 변경은 base revision 좌표 순서로 정렬돼야 하며 서로 겹치지 않는다.
- 빈 범위에 빈 문자열을 삽입하는 no-op은 허용하지 않는다.
- 삽입 문자열도 LF-only이며 Unicode normalization을 적용하지 않는다.
- 삽입·삭제 길이를 합산한 값은 `afterTextLengthUtf16`과 정확히 같아야 한다.
- v1에 없는 필드는 조용히 버리지 않고 거부한다.

## Canonical serialization

canonical record는 다음 고정 순서 tuple이다.

```text
[
  "change-batch",
  schemaVersion,
  [
    textRepresentation.schemaVersion,
    textRepresentation.offsetUnit,
    textRepresentation.lineEnding,
    textRepresentation.unicodeNormalization,
    textRepresentation.hashAndAnchorInputEncoding
  ],
  batchId,
  workId,
  documentId,
  baseRevisionId,
  sequence,
  createdAt,
  beforeTextLengthUtf16,
  afterTextLengthUtf16,
  changes.map([fromUtf16, toUtf16, insertedText])
]
```

tuple을 `JSON.stringify`한 뒤 UTF-8로 인코딩한다. 입력 객체의 key 순서는 canonical bytes에 영향을 주지 않는다. Unicode normalization은 하지 않으므로 NFC와 NFD 원문은 서로 다른 bytes다.

## Identity와 대상 검증

- `batchId`가 다르면 `distinct`다.
- `batchId`와 canonical bytes가 모두 같으면 idempotent `duplicate`다.
- `batchId`는 같고 canonical bytes가 다르면 `conflict`다.

application validator는 journal append 전에 다음을 모두 확인한다.

1. `workId`가 등록된 작품이다.
2. `documentId`가 등록 문서이며 해당 작품이 소유한다.
3. 문서의 현재 durable revision이 존재한다.
4. 현재 revision의 문서·identity가 batch 대상과 일치한다.
5. replay·append orchestration이 현재 journal head에 batch를 원자 적용하면서 `beforeTextLengthUtf16`을 검증한다.

durable revision 길이는 첫 batch 이후 변화하는 journal head 길이를 대신하지 않는다. sequence 연속성, duplicate receipt 재사용, append 원자성은 journal이 소유한다. 다른 작품·문서·revision으로 fallback하지 않는다.

## 다음 검증 단위

- append-only record framing
- payload length와 checksum
- torn write·truncated/corrupted tail 격리
- 마지막 정상 record까지의 결정적 복구
