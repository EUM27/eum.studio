import type { SceneDeletionPreview } from "../../application/structure/scene-trash-contract";

export function SceneDeletionDialog(input: Readonly<{
  preview: SceneDeletionPreview | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const preview = input.preview;
  if (preview === null) return null;
  const deletedUtf16Length = preview.documents.reduce(
    (sum, document) => sum + document.deletedUtf16Length,
    0,
  );

  return (
    <div className="dialog-backdrop">
      <section
        aria-label="장면 삭제 미리보기"
        className="create-work-dialog scene-deletion-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">SCENE TRASH</p>
            <h3>장면 삭제 미리보기</h3>
          </div>
        </header>
        <p>
          {`원고 ${deletedUtf16Length.toLocaleString("ko-KR")}자와 장면 경계를 휴지통으로 이동합니다.`}
        </p>
        <ul aria-label="삭제될 회차 범위">
          {preview.documents.map((document) => (
            <li key={document.documentId}>
              <strong>{document.documentTitle}</strong>
              <span>{`${document.deletedUtf16Length.toLocaleString("ko-KR")}자`}</span>
              <p>{`처음: ${document.firstExcerpt}`}</p>
              <p>{`마지막: ${document.lastExcerpt}`}</p>
            </li>
          ))}
        </ul>
        <section aria-label="연결된 장면 정보">
          <h4>{`연결된 사건·주석·음악 ${preview.metadata.length}건`}</h4>
          {preview.metadata.length === 0 ? (
            <p>연결된 장면 정보가 없습니다.</p>
          ) : (
            <ul>
              {preview.metadata.map((metadata) => (
                <li key={`${metadata.kind}:${metadata.metadataId}`}>
                  {metadata.label}
                </li>
              ))}
            </ul>
          )}
        </section>
        {input.error !== null && <p role="alert">{input.error}</p>}
        <footer>
          <button disabled={input.busy} onClick={input.onCancel} type="button">
            취소
          </button>
          <button disabled={input.busy} onClick={input.onConfirm} type="button">
            휴지통으로 이동
          </button>
        </footer>
      </section>
    </div>
  );
}
