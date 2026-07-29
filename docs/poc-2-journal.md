# POC-2 append-only journal framing

상태: framing·append·scan·replay·durable save command·renderer 저장 상태 구현, crash-safe lifecycle 미완료

실사용 원고 저장: `NO-GO`

상위 payload 계약: [POC-2 저장 문자열과 ChangeBatch v1](poc-2-durable-change-batch.md)

이 문서는 `ChangeBatch` canonical bytes를 append-only 파일에 기록하고 검증 가능한 prefix를 탐색한 뒤 결정적으로 replay하는 journal 계약을 기록한다. application save command와 `SaveReceipt`, main typed command, renderer 저장 상태까지 구현했지만 compaction과 kill harness는 아직 연결하지 않았다.

## Checksum adapter

제품 코드는 특정 checksum 알고리즘을 기본값으로 고정하지 않는다. 호출자가 다음 계약을 만족하는 adapter를 주입한다.

```ts
type JournalChecksumAdapter = {
  readonly id: string;
  readonly byteLength: number;
  digest(input: Uint8Array): Promise<Uint8Array>;
};
```

- `id`는 비어 있지 않아야 한다.
- `byteLength`는 양의 safe integer여야 한다.
- `digest()` 결과 길이는 선언한 `byteLength`와 정확히 같아야 한다.
- frame은 adapter `id`를 보존하며 scanner는 같은 identity의 adapter로만 검증한다.

POC runtime에 사용할 실제 adapter와 algorithm 선택은 main 저장 경로 연결 task가 runtime 입력으로 제공한다. framing 계층은 알고리즘을 선택하거나 fallback하지 않는다.

## JournalEntry frame v1

```text
4-byte unsigned big-endian header byte length
canonical header UTF-8 bytes
payload bytes
checksum bytes
```

canonical header는 다음 tuple을 `JSON.stringify`한 UTF-8 bytes다.

```text
[
  "journal-entry",
  1,
  checksumAdapterId,
  payloadByteLength,
  checksumByteLength
]
```

checksum 입력은 prefix를 제외한 `canonical header bytes + payload bytes`다. payload는 `serializeCanonicalChangeBatch()` 결과다.

scanner는 header를 다시 canonical encoding했을 때 원래 header bytes와 정확히 같아야 승인한다. schema version, adapter identity, payload length, checksum length가 frame마다 self-describing 상태로 남는다.

## Durable append 순서

1. payload 사본으로 완전한 frame을 만든다.
2. 호출자가 제공한 journal 경로를 append mode로 연다.
3. frame 전체가 기록될 때까지 각 `FileHandle.write()`를 순서대로 await한다.
4. write가 진행하지 못하거나 실패하면 즉시 실패한다.
5. 전체 frame write 뒤 `FileHandle.sync()`를 await한다.
6. `sync()`가 성공한 뒤에만 frame byte 범위를 반환한다.
7. handle은 `finally`에서 닫는다.

write·sync 오류를 성공으로 바꾸거나 retry하지 않는다. Node.js는 `sync()`를 storage device flush 요청으로 정의하지만 실제 구현은 운영체제와 장치에 의존한다. POC-2의 process-kill harness가 이 경계의 실제 복구 결과를 별도로 증명해야 한다.

## Scan과 손상 tail

scanner는 시작 offset부터 frame을 순서대로 검증한다.

- length prefix가 잘림
- header가 잘리거나 canonical v1이 아님
- payload 또는 checksum이 잘림
- checksum adapter를 해결할 수 없음
- checksum 불일치

위 조건을 처음 발견한 frame에서 즉시 멈춘다. 그 이전 frame만 verified records로 반환하며 다음 정보를 함께 보존한다.

- verified prefix byte length
- tail 시작 byte offset
- 실패 reason
- tail의 원시 bytes 전체

손상 뒤 bytes를 찾아 resync하거나 적용하지 않는다. 원본 journal 파일을 scanner가 truncate·교정·삭제하지 않는다. replay 계층은 verified records만 적용하고 tail은 복구 issue 정보로 격리해야 한다.

## Deterministic replay

application replay는 platform frame 타입을 import하지 않고 verified payload bytes와 명시적인 초기 target을 입력으로 받는다. target은 다음 값을 소유한다.

- `workId`
- `documentId`
- `baseRevisionId`
- 현재 journal head 본문
- 호출자가 제공한 다음 expected sequence

각 payload는 canonical `ChangeBatch`로 decode하고 원래 bytes와 재직렬화 bytes가 정확히 같을 때만 승인한다.

1. 같은 `batchId`와 같은 canonical bytes를 이미 적용했다면 duplicate로 기록하고 본문에는 다시 적용하지 않는다.
2. 같은 identity의 다른 canonical bytes는 identity conflict로 격리한다.
3. target 문서가 없거나 작품·base revision이 다르면 fallback하지 않고 해당 record에서 멈춘다.
4. expected sequence보다 크면 gap, 작으면 stale sequence로 격리한다.
5. `beforeTextLengthUtf16`은 durable base revision 길이가 아니라 현재 journal head 본문 길이와 비교한다.
6. ordered changes 전체를 base 좌표로 조립한 새 문자열이 선언한 결과 길이와 일치할 때만 target 본문과 다음 sequence를 함께 교체한다.
7. invalid record 이후 payload는 적용하지 않는다.

초기 expected sequence는 제품 코드가 정하지 않고 호출자가 durable journal 상태에서 제공한다.

## 직렬 durable save command

application의 `SaveChangeBatch`는 호출자가 제공한 작품·문서별 현재 journal head와 다음 expected sequence를 사본으로 소유한다. 각 호출은 순서대로 실행하며 다음 검증을 통과한 경우에만 canonical payload를 journal append port에 전달한다.

- 등록된 target 문서이며 작품과 base revision이 정확히 일치
- sequence가 현재 expected sequence와 정확히 일치하고 다음 safe integer로 전진 가능
- ordered changes가 현재 journal head 본문에 원자 적용 가능
- 기존 application target validator가 작품·문서 소유권과 현재 durable base revision을 승인

append port의 성공은 frame 전체 append와 `FileHandle.sync()` 성공을 뜻한다. 그 결과가 반환된 뒤에만 작품·문서·base revision·batch identity·sequence와 durable frame byte 범위를 담은 `SaveReceipt`를 만든다. 그 전에는 journal head와 accepted identity를 전진시키지 않는다.

동시에 들어온 호출도 앞선 durable append가 끝난 뒤 다음 sequence를 검증한다. 같은 session에서 이미 승인한 `batchId`와 canonical bytes가 정확히 같은 호출은 기존 receipt를 반환하고 다시 append하지 않는다. 같은 identity의 다른 bytes, gap·stale·overflow, 본문 apply 충돌은 append 전에 실패한다. append·sync 실패도 성공 receipt로 변환하거나 자동 retry하지 않는다.

journal 경로와 checksum adapter는 이 command의 입력이 아니며 platform port가 runtime 입력으로 소유한다. renderer의 batch 크기·지연도 이 계층이 고정하지 않는다.

## Desktop POC runtime wiring

desktop POC는 별도의 manuscript journal runtime profile이 있을 때만 save command를 구성한다.

```text
{
  schemaVersion,
  journalPath,
  checksumAlgorithm,
  documentSequences: [
    { documentId, nextSequence }
  ]
}
```

profile은 inline JSON 또는 호출자가 선택한 JSON 파일 중 하나로 전달한다. `journalPath`, Node.js runtime이 지원하는 `checksumAlgorithm`, 각 등록 문서의 초기 `nextSequence`에 제품 기본값이나 fallback을 두지 않는다.

작품·base revision·초기 본문은 journal profile이 중복 소유하지 않고 manuscript document profile의 exact `documentId`에서 가져온다. 두 profile의 문서 집합이 정확히 일치해야 하며 null base revision, 누락·중복·미등록 sequence 문서는 runtime 구성 시 거부한다.

Node crypto adapter는 runtime algorithm 문자열을 identity로 그대로 보존하고 `createHash()` 결과를 frame checksum으로 사용한다. 지원되지 않는 algorithm을 다른 값으로 바꾸지 않는다.

preload는 `saveChangeBatch(ChangeBatch): Promise<SaveReceipt>` 하나의 allowlisted channel만 추가로 노출한다. outbound batch와 inbound receipt를 application parser로 검증하며 main rejection을 성공 receipt로 바꾸지 않는다. journal profile이 없으면 save handler는 persistence-unavailable로 실패하고 파일을 만들지 않는다.

batching policy는 journal storage profile과 별도 runtime 입력으로 받는다.

```text
{
  schemaVersion,
  maxTransactionsPerBatch,
  maxDelayMs
}
```

main은 journal profile과 batching policy가 모두 있을 때만 renderer persistence profile을 projection한다. 이 조회 결과에는 batching policy와 journal profile에서 파생한 `documentId`·`nextSequence`만 포함하며 journal path와 checksum algorithm은 포함하지 않는다. 어느 한 입력이 없으면 명시적 `null` projection을 반환한다. preload는 이 strict query channel 하나를 allowlist에 추가한다.

## Renderer batching·receipt state machine

renderer의 합성·queue 계층은 storage 설정과 분리된 caller batching policy를 입력으로 받는다.

```text
{
  maxTransactionsPerBatch,
  maxDelayMs
}
```

두 값에 제품 기본값을 두지 않는다. 각 `ManuscriptTransaction`의 좌표 changes를 `ChangeSet.of()`로 재구성하고, 연속 change set을 `compose()`해 최초 pending 본문의 base UTF-16 좌표로 합친다. flush에서만 `iterChanges()`로 최종 inserted fragments를 materialize하므로 입력마다 전체 원고 문자열을 읽지 않는다.

문서별 durable queue는 caller가 제공한 작품·문서·base revision·초기 next sequence를 소유한다.

- transaction count 경계 또는 delay 만료 시 composed `ChangeBatch` 하나를 flush한다.
- IME composition active 중에는 size·timer·명시적 flush가 save command를 시작하지 않는다.
- concurrent save 중 새 변경은 in-flight batch와 분리된 다음 accumulator에 보존한다.
- 실패한 in-flight batch는 identity·createdAt·changes를 바꾸지 않고 유지한다.
- 실패를 자동 retry하지 않으며 다음 명시적 flush만 같은 immutable batch를 다시 호출한다.
- receipt의 작품·문서·base revision·batch identity·sequence가 요청과 정확히 일치할 때만 next sequence를 전진시킨다.
- sequence가 safe integer로 전진할 수 없으면 pending changes를 버리지 않고 실패한다.

상태는 pending 변경에서 `editing`, receipt 대기에서 `saving`, exact receipt와 pending 0에서 `saved`, command rejection 또는 receipt identity 불일치에서 `failed`다. in-flight 중 새 변경이 생기면 `editing`이 우선한다.

ManuscriptEditor는 transaction마다 CodeMirror의 composition 상태를 함께 전달한다. blur와 문서 전환은 현재 문서 queue를 명시적으로 flush하고, composition end는 최종 CodeMirror mutation 뒤 queue의 hold를 해제한다. App은 runtime projection이 있을 때만 문서별 queue를 구성하며 `editing / saving / saved / failed`를 각각 `편집 중 / 저장 중 / 저장됨 / 실패`로 표시한다.

실제 Electron 검증은 조합 시간이 batching delay를 넘어도 journal 파일이 생기지 않는지, 조합 확정 뒤 한 frame만 append되는지, blur와 문서 전환에서 정확한 문서 batch가 durable replay되는지, append 실패가 `실패`로 남는지를 확인한다.

## Application startup recovery candidate

startup recovery application은 platform frame 타입이나 파일 API를 import하지 않는다. caller가 checksum 검증을 끝낸 payload와 frame 시작·끝 offset, source journal end, checksum-verified prefix boundary, frame tail issue를 전달한다.

application은 기존 durable revision targets에 records를 순서대로 replay한다. 첫 logical replay issue에서 멈추며 그 record의 frame 시작 offset 전까지만 safe prefix로 확정한다. frame tail은 checksum-verified prefix 뒤의 별도 issue로 보존한다. issue 뒤 record를 resync하거나 적용하지 않는다.

safe prefix에 실제 적용된 batch가 있으면 다음 값의 `recovery-pending` 후보를 만든다.

- source journal end
- checksum-verified prefix boundary
- logically safe replay boundary
- 정확한 영향 Work·Document·base revision·복구 본문·next sequence
- 적용·중복 batch identity
- apply에 사용할 safe canonical payload
- frame tail·logical replay issue

적용된 batch와 issue가 모두 없으면 `clean`이다. issue는 있지만 안전하게 적용된 변경이 없으면 새 revision을 추정해 만들지 않고 `read-only-error`로 분리한다. 영향받지 않은 문서는 후보 projection에 포함하지 않으며 다른 작품·문서 본문으로 대체하지 않는다.

명시적 recovery apply를 구성하려면 caller가 별도 POC runtime profile로 다음을 모두 제공해야 한다.

- compaction identity
- expected source journal end와 safe replay boundary
- content checksum algorithm
- source·next journal path
- publication temporary·final path
- 영향 문서별 Work·Document·expected base revision·new revision identity
- revision cause·createdAt·durableAt·content path

profile parser는 unknown field, 누락·빈 값, unsafe boundary, source end 뒤 safe boundary, 빈 revision 목록, 중복 Document·revision identity를 거부한다. 어떤 값에도 default나 fallback이 없고 제품 storage layout을 결정하지 않는다.

## Desktop startup source resolution

desktop startup resolver는 recovery apply profile이 있으면 physical journal scan보다 먼저 final compaction publication을 검증한다.

- final이 없으면 baseline document revision과 source journal generation을 사용한다.
- final이 checksum·identity·content·next generation 검증을 통과하면 published immutable revisions와 next journal generation을 last confirmed source로 사용한다.
- final이 invalid하거나 baseline Work·Document·expected base revision·caller plan과 다르면 `publication-invalid` read-only issue로 반환하고 baseline 또는 다른 revision으로 fallback하지 않는다.

published source를 선택하면 영향 문서의 revision identity·본문과 next sequence만 exact publication 값으로 교체하고, 영향받지 않은 문서는 baseline 값을 유지한다. 이후 선택된 active journal generation만 caller journal checksum resolver로 scan해 pure application startup recovery에 전달한다.

baseline journal 파일이 아직 없으면 파일을 생성하지 않고 empty clean state로 해석한다. 파일이 있으면 scan은 읽기 전용이며 tail을 truncate·교정·삭제하지 않는다. safe batch가 없는 tail-only 결과는 save profile을 노출하지 않는 read-only 상태가 된다.

## Renderer recovery contract

renderer recovery projection은 `clean / recovery-pending / read-only-error` 상태와 preview에 필요한 logical 값만 전달한다. pending candidate에는 source journal end, checksum-verified boundary, safe replay boundary, 영향 문서의 정확한 소유권·base revision·복구 본문·next sequence, 적용·중복 batch identity, issue가 포함된다.

다음 main/platform 원본은 renderer에 전달하지 않는다.

- safe canonical payload bytes
- raw journal tail bytes
- journal·revision content·publication paths
- checksum algorithm

explicit apply command는 현재 candidate에서 생성한 schema version, expected source journal end, expected safe replay boundary, 영향 문서별 Work·Document·expected base revision·expected next sequence를 모두 포함한다. main은 command tuple과 보관 중인 candidate를 순서까지 exact 비교하며 하나라도 다르면 stale approval로 거부한다. projection의 apply availability가 false면 candidate를 자동 적용하거나 command 값을 추정하지 않는다.

## Explicit recovery apply

desktop apply service는 보관 중인 `recovery-pending` candidate, renderer의 exact approval command, caller recovery apply profile을 모두 비교한다. active journal path, source end, safe replay boundary, revision plan 수·순서, Work·Document·expected base revision이 모두 같고 새 revision ID가 base와 다를 때만 application compaction을 호출한다.

compaction final publication rename 전에는 effective document/journal profile을 바꾸지 않는다. publication이 완료되면 같은 baseline과 apply profile로 startup source를 다시 resolve해 published revision content·next sequence·next journal generation을 확인한 뒤 결과를 반환한다. 과거 baseline profile은 수정하지 않는다.

candidate에 frame tail 또는 logical replay issue가 있으면 safe payload만 새 revision으로 게시하고 기존 source journal generation은 byte-for-byte 격리 보존한다. 이때 reclamation은 `pending`이며 자동 retry하지 않는다. issue가 없을 때만 publication 성공 후 source generation을 reclaim한다.

recovery query와 explicit apply는 각각 별도 typed bridge channel이다. preload allowlist는 이 두 channel을 명시적으로 허용하지만 범용 `send`·`invoke`나 파일 API를 노출하지 않는다. renderer bridge는 recovery projection과 apply acknowledgement를 모두 strict parse하고 unknown·malformed main 응답을 거부한다.

apply acknowledgement는 schema version, `applied` status, compaction identity, consumed source boundary, `completed / pending` reclamation만 전달한다. renderer는 이 값을 revision source로 저장하지 않고 main의 document·persistence·recovery query를 다시 읽어 화면 상태를 갱신한다.

## Application compaction publication protocol

물리 revision·journal layout과 SQLite transaction 방식은 POC-3 결정이므로 POC-2 application은 다음 순서만 port 계약으로 강제한다.

1. verified journal prefix 전체를 기존 durable targets에 replay한다.
2. prefix에 등장한 모든 영향 문서에 caller가 제공한 새 revision plan이 정확히 하나씩 있는지 확인한다.
3. 각 replay 결과를 새 불변 revision content로 prepare한다.
4. prepare된 content를 다시 materialize하고 canonical manuscript UTF-16LE bytes의 caller checksum으로 source/result가 같은지 확인한다.
5. 게시 시 journal end가 caller가 scan한 consumed boundary와 여전히 같은지 platform transaction이 검증한다.
6. 모든 영향 문서의 새 durable base·다음 sequence와 consumed boundary를 한 publication으로 원자 게시한다.
7. publication 성공 뒤에만 이전 journal prefix reclamation을 요청한다.

publication 전에 실패하거나 journal end가 바뀌면 기존 base와 journal이 recovery source of truth로 남고 reclamation을 호출하지 않는다. publication 뒤 reclamation이 실패하면 새 base와 consumed boundary가 source of truth이며 기존 journal bytes는 남겨 두고 결과를 `pending`으로 반환한다. 자동 retry하지 않는다.

compaction scan과 publication 사이에 append된 suffix는 기존 base를 참조하므로 journal end가 바뀐 publication을 허용하지 않는다. platform transaction은 save append와 publication을 직렬화하거나 expected end conflict로 거부하고, 성공 publication 뒤의 새 append가 새 base revision을 사용하게 해야 한다.

## POC-only process-durable generation adapter

POC-2 강제 종료 검증용 platform adapter는 caller가 제공한 다음 exact paths만 사용한다.

- source journal
- next journal generation
- publication temporary file
- publication final file
- 영향 문서별 새 revision content file

경로·identity·checksum algorithm에는 default나 fallback이 없다. publication temporary와 final path는 rename commit point를 위해 같은 directory에 있어야 하며 모든 storage path는 서로 달라야 한다.

adapter는 각 revision content를 canonical manuscript UTF-16LE bytes로 exclusive write하고 sync한다. 이어서 빈 next journal generation을 exclusive create하고 sync한다. source journal size가 caller의 expected end와 일치하는지 확인한 뒤 compaction provenance와 모든 revision checksum을 canonical payload로 만들고 기존 journal checksum frame으로 감싼다. frame을 publication temporary path에 exclusive write·sync하고 source journal size를 다시 확인한 뒤 final path로 rename한다.

restart resolver는 final publication이 없으면 `not-published`로 반환한다. final이 있으면 single checksum-valid frame, canonical payload, compaction·path identity, next journal frame 상태, 모든 revision content checksum을 다시 확인한 뒤에만 `published`로 반환한다. publication·revision content checksum adapter와 이후 active journal generation의 checksum resolver는 caller가 각각 제공한다. 둘을 묵시적으로 같은 알고리즘으로 제한하거나 한쪽을 fallback으로 사용하지 않는다. 손상은 `invalid`와 reason으로 구분하고 다른 revision이나 journal로 fallback하지 않는다.

source journal은 publication rename 뒤에만 unlink한다. unlink 실패는 application result의 `pending` reclamation이 되며 publication을 취소하지 않는다. 이 adapter는 OS process kill 증거를 만들기 위한 POC generation이며 power-loss와 최종 제품 storage layout을 주장하지 않는다.

## POC-only ResumeCheckpoint publication

ResumeCheckpoint process-kill 검증용 transaction은 caller가 publication temporary/final exact paths, checksum adapter, typed state codec을 제공할 때만 구성한다. codec은 자체 identity와 전체 publication payload의 encode/decode를 소유하며 platform은 serialization format을 선택하거나 fallback하지 않는다.

publication payload는 다음 원본을 함께 소유한다.

- publication·codec identity
- expected Work revision과 기존 `resumeCheckpointId`
- expected current durable document revision
- application이 구성한 next Work 전체 사본
- 새 ResumeCheckpoint 전체 사본
- transaction이 소유한 Anchor 전체 사본

transaction은 current durable revision과 기존 InMemory capture의 Work revision·pointer·duplicate checkpoint·next Work 전이 불변식을 그대로 확인한다. caller codec이 encoded bytes를 즉시 decode했을 때 원본 publication과 deep-strict equality를 만족하고 핵심 identity 관계도 유지해야 한다. 그 뒤에만 checksum frame을 temporary path에 exclusive write·sync하고 final path로 rename한다. rename 성공 뒤에만 in-process Work·checkpoint map을 copy-on-write 교체한다.

restart resolver는 final이 없으면 baseline을 반환한다. final이 있으면 frame checksum, codec decode, publication·Work·checkpoint identity, 기존 Work revision·pointer, current durable revision을 검증하고 모두 유효할 때만 next Work·checkpoint·Anchor를 baseline에 merge한다. invalid frame·codec·identity·revision은 새 상태를 선택하지 않고 baseline과 reason을 함께 반환한다.

## Actual process-kill stage gate

승인 crash matrix의 journal command 경계는 explicit POC crash gate profile이 있을 때만 주입한다.

```text
{
  schemaVersion,
  scenarioId,
  targetStage,
  reachedPath
}
```

지원 stage는 다음 세 지점이다.

- `save-target-validated`: application target validator 성공 직후
- `before-journal-append`: canonical payload 생성 뒤 append port 호출 직전
- `journal-frame-written-before-sync`: frame 전체 write 뒤 `FileHandle.sync()` 호출 직전

profile에는 path·stage·scenario default가 없다. target stage에 도달하면 caller reached path에 scenario·stage marker를 exclusive write하고 sync한 뒤 영구 pending gate에 들어간다. parent harness는 marker와 main PID를 확인한 뒤 actual SIGKILL을 수행한다. target이 아닌 stage는 marker나 pending을 만들지 않는다.

profile이 없으면 desktop persistence runtime은 lower-layer callback을 전달하지 않는다. application과 journal은 hook이 없는 기본 경로에서 optional await를 실행하지 않아 기존 append·ack timing을 보존한다. hook rejection은 append 전이면 file을 만들지 않고, write 후 sync 전이면 durable receipt를 반환하지 않는다.

## 현재 자동 검증

- 같은 payload와 adapter가 같은 frame bytes를 만든다.
- 정상 frame을 payload 손실 없이 round-trip한다.
- 정상 frame 뒤 checksum이 손상된 frame을 붙이면 정상 prefix 하나만 복구한다.
- 뒤따르는 frame의 모든 truncated cut에서 같은 정상 prefix와 정확한 원시 tail을 반환한다.
- 실제 임시 파일에 frame 두 개를 durable append하고 append 순서대로 scan한다.
- canonical bytes를 validated `ChangeBatch`로 정확히 decode한다.
- 연속 batch 두 개와 첫 batch duplicate를 replay하면 각 batch가 정확히 한 번만 적용된다.
- sequence gap·cross-work·현재 journal head 길이 불일치·identity conflict에서 마지막 정확한 본문을 보존한다.
- 다음 sequence가 safe integer로 표현되지 않으면 적용 전에 멈춘다.
- durable append가 끝나기 전에 `SaveReceipt`가 resolve되지 않는다.
- concurrent sequence를 직렬 append하고 두 번째 batch를 첫 durable head에 검증한다.
- exact duplicate는 기존 receipt를 반환하며 identity·sequence·소유권·base revision 충돌은 append하지 않는다.
- append 실패 뒤 head를 전진시키지 않아 같은 sequence의 명시적 재호출을 정확히 검증한다.
- runtime journal profile의 unknown field·중복 문서·unsafe sequence를 거부한다.
- 호출자가 선택한 현재 Node crypto algorithm으로 digest를 생성하고 unsupported algorithm을 fallback하지 않는다.
- document profile과 sequence profile을 exact join해 실제 임시 journal에 append+sync한다.
- 실제 Electron renderer에서 좁은 preload command를 호출해 main의 durable receipt와 scan한 frame byte 범위를 대조한다.
- caller transaction count·delay 경계에서 composed batch 하나만 호출한다.
- IME active 중 flush 요청을 hold하고 composition end 뒤에만 save command를 시작한다.
- 실패한 immutable in-flight batch를 자동 retry하지 않고 명시적 flush에서 같은 객체로 다시 호출한다.
- in-flight 이후 새 편집을 다음 sequence와 앞 batch의 결과 길이로 분리한다.
- 다른 batch의 receipt와 sequence overflow에서 state를 전진시키거나 pending changes를 버리지 않는다.
- batching policy와 renderer projection은 unknown storage field·duplicate document·invalid size·delay를 거부하고 깊게 동결한다.
- persistence profile bridge query는 path·checksum 없이 policy·document sequence 또는 explicit null만 반환한다.
- 실제 Electron에서 blur 뒤 exact durable receipt가 도착한 경우에만 `저장됨`이 표시되고 journal replay 결과가 입력 본문과 일치한다.
- journal append가 실패하면 `실패`가 표시되고 `저장됨`으로 바뀌지 않는다.
- 한글 IME 조합 중 batching delay가 지나도 journal 파일을 만들지 않고 확정 뒤 한 frame만 append한다.
- 문서 전환은 이전 문서 batch를 즉시 flush하며 다른 문서의 작품·문서·base revision으로 대체하지 않는다.
- 다중 문서 journal prefix를 모두 새 불변 revision으로 prepare·materialize한 뒤 한 publication으로 게시하고 이후에만 reclamation한다.
- replay issue·영향 문서 plan 불일치·source/result checksum 불일치·journal-end publication conflict에서는 reclamation하지 않는다.
- publication 후 reclamation 실패는 한 번만 호출하고 `pending`으로 반환한다.
- 실제 임시 파일에서 revision과 next journal을 sync하고 publication을 rename한 뒤에만 source journal을 unlink한다.
- publication temp sync 뒤 중단과 publication 직전 source journal 증가에서 final publication을 만들지 않고 source journal을 유지한다.
- publication 뒤 source journal unlink 실패에서도 restart resolver가 새 publication을 선택한다.
- 게시된 revision content가 바뀌면 restart resolver가 checksum 불일치로 신뢰하지 않는다.
- publication/content와 다른 caller-selected checksum adapter로 채워진 active journal generation도 별도 resolver로 검증한다.
- Work pointer·ResumeCheckpoint·Anchor 전체 사본을 한 frame으로 게시하고 restart에서 함께 복구한다.
- checkpoint publication temp sync 뒤 중단은 transaction 메모리와 restart baseline 모두 기존 Work pointer를 유지한다.
- publication rename 뒤 acknowledgement 유실은 restart에서 새 Work pointer와 checkpoint를 함께 복구한다.
- final frame 손상과 codec encode·decode·round-trip failure를 성공 publication으로 바꾸지 않는다.
- validation 완료·append 직전 hook rejection이 journal head를 전진시키거나 append receipt를 만들지 않는다.
- frame write 후 sync 직전 hook rejection은 frame bytes가 file에 보여도 durable receipt를 반환하지 않는다.
- crash gate는 target marker를 sync한 뒤 caller pending에 들어가고 다른 stage에서는 아무 파일도 만들지 않는다.
- crash profile이 없는 desktop runtime과 Electron E2E는 기존 저장 동작을 유지한다.
- 빈 journal은 clean으로 분류하고 checksum-valid·logically safe prefix만 recovery-pending 후보로 만든다.
- logical issue 직전의 exact frame boundary에서 replay를 멈추고 이전 적용 본문과 issue를 함께 보존한다.
- frame tail만 있고 적용 가능한 batch가 없으면 revision을 만들지 않고 read-only issue로 분리한다.
- 다중 document journal에서 실제 적용된 document만 정확한 소유권과 복구 본문으로 projection한다.
- recovery apply profile의 identity·boundary·checksum·metadata·모든 path를 default 없이 strict parse한다.
- final publication 유무를 먼저 해석하고 baseline 또는 published revision+active generation의 exact source만 scan한다.
- invalid final publication은 baseline fallback 없이 read-only issue로 분리한다.
- tail-only physical journal은 byte-for-byte 유지하고 save 가능한 startup source를 반환하지 않는다.
- renderer recovery projection은 preview logical 값만 전달하고 raw payload·tail·path·algorithm을 제외한다.
- apply command의 source/safe boundary와 모든 affected document tuple이 current candidate와 exact match해야 한다.
- exact candidate·command·caller profile이 모두 일치할 때만 새 immutable revision publication을 실행한다.
- issue suffix가 있으면 safe prefix 게시 뒤 source journal을 byte-for-byte 보존하고 reclamation pending으로 남긴다.
- recovery query·apply command는 별도 narrow preload channel이며 main 응답도 renderer에서 strict parse한다.
- pending·read-only renderer는 baseline 원고를 `readOnly`와 non-editable DOM으로 함께 잠그고 save queue를 만들지 않는다.
- pending candidate의 exact recovered text를 먼저 표시하며 apply profile이 있는 경우에만 명시적 적용 control을 제공한다.
- apply acknowledgement 뒤 main의 document·persistence·recovery projection을 다시 조회한 경우에만 같은 Document의 새 confirmed revision source로 EditorState를 교체한다.
- 적용 뒤 Electron을 완전히 종료·재실행해도 final publication에서 같은 immutable revision 본문과 writable next generation을 복원한다.
- active journal read 오류는 physical path 없이 read-only issue로 projection하며 창 생성을 중단하거나 baseline write를 허용하지 않는다.
- actual process kill harness는 save 5단계·compaction 2단계·checkpoint 2단계에서 Electron main 또는 Node worker를 강제 종료한 뒤 restart resolver와 Electron 화면의 source·journal sequence·본문 checksum을 비교한다.
- 최신 전체 실행은 9/9 통과했다. `artifacts/poc-2-crash/crash-matrix.json`은 source·recoverable·displayed checksum과 journal sequence, recovery classification을 기록하되 원고 원문을 기록하지 않는다.
- production-bundle 성능 측정은 입력 전에 설치한 save-state observer로 exact `저장됨` 주기를 측정한다. 3개 독립 실행의 36개 durable ack raw sample이 승인 500ms p95 예산을 통과했다.
- 세 실행 모두 journal compaction publication·source reclamation·복구 checksum을 검증했고, main RSS·renderer heap 45개와 renderer GC 전후 9개 raw sample을 함께 기록했다.
- crash·performance artifact는 commit·porcelain status checksum·tracked diff checksum·untracked 경로/내용 checksum 집계와 그 전체 source fingerprint를 직접 소유한다.
- installed-package POC는 caller profile이 지정한 기존 Electron runtime과 production bundles를 OS 임시 `resources/app` 구조에 조립하고 Chromium user-data도 임시 경로에 둔다. 최종 shipping packaging 설정이나 dependency는 선택하지 않는다.
- package executable에서 exact `저장됨` 주기를 관찰한 뒤와 recovery publication 뒤 actual main PID를 각각 종료하고 published revision·정확한 cursor 재실행을 검증했다. 실패한 package 조립은 검증된 임시 parent를 제거하고 active Electron tree도 outer cleanup에서 정리한다. package tree·latency·checksum·exact source provenance는 생성 artifact가 직접 소유한다.

## 다음 검증 단위

- `POC-3 — SQLite·불변 blob·백업`의 driver bake-off와 물리 저장 경계
