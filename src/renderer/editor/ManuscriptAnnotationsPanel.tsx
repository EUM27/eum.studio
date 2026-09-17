import { useMemo, useState } from "react";

import type { ManuscriptAnnotationProjection } from "../../application/review/manuscript-annotation-contract";
import type { EntityId } from "../../domain/writing";

const TAG_SUGGESTIONS = Object.freeze([
  "수정 필요",
  "삭제 검토",
  "복선",
  "설정 확인",
]);

function toggleTag(
  tags: readonly string[],
  tag: string,
): readonly string[] {
  return tags.includes(tag)
    ? Object.freeze(tags.filter((candidate) => candidate !== tag))
    : Object.freeze([...tags, tag]);
}

function AnnotationTagsEditor(input: Readonly<{
  tags: readonly string[];
  onChange: (tags: readonly string[]) => void;
}>) {
  const [customTag, setCustomTag] = useState("");
  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag.length === 0 || input.tags.includes(tag)) return;
    input.onChange(Object.freeze([...input.tags, tag]));
    setCustomTag("");
  };
  return (
    <div className="manuscript-annotation-tag-editor">
      <div aria-label="주석 태그" className="manuscript-annotation-tag-options">
        {TAG_SUGGESTIONS.map((tag) => (
          <button
            aria-pressed={input.tags.includes(tag)}
            className="manuscript-annotation-tag-button"
            key={tag}
            onClick={() => input.onChange(toggleTag(input.tags, tag))}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>
      {input.tags.filter((tag) => !TAG_SUGGESTIONS.includes(tag)).length > 0 && (
        <div className="manuscript-annotation-custom-tags">
          {input.tags
            .filter((tag) => !TAG_SUGGESTIONS.includes(tag))
            .map((tag) => (
              <button
                aria-label={`${tag} 태그 제거`}
                key={tag}
                onClick={() => input.onChange(toggleTag(input.tags, tag))}
                type="button"
              >
                {tag} ×
              </button>
            ))}
        </div>
      )}
      <div className="manuscript-annotation-custom-tag-input">
        <input
          aria-label="사용자 태그"
          onChange={(event) => setCustomTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomTag();
            }
          }}
          placeholder="태그 직접 입력"
          value={customTag}
        />
        <button onClick={addCustomTag} type="button">
          태그 추가
        </button>
      </div>
    </div>
  );
}

export function ManuscriptAnnotationsPanel(input: Readonly<{
  activeDocumentId: EntityId<"Document"> | null;
  annotations: readonly ManuscriptAnnotationProjection[];
  busy: boolean;
  documentTitles: Readonly<Record<string, string>>;
  error: string | null;
  hasSelection: boolean;
  onCreate: (
    body: string,
    tags: readonly string[],
  ) => Promise<ManuscriptAnnotationProjection | null>;
  onOpen: (annotation: ManuscriptAnnotationProjection) => void;
  onRetire: (annotation: ManuscriptAnnotationProjection) => Promise<boolean>;
  onUpdate: (
    annotation: ManuscriptAnnotationProjection,
    changes: Readonly<{ body: string; tags: readonly string[] }>,
  ) => Promise<ManuscriptAnnotationProjection | null>;
}>) {
  const [showAll, setShowAll] = useState(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<readonly string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editingTags, setEditingTags] = useState<readonly string[]>([]);
  const visible = useMemo(
    () => showAll
      ? input.annotations
      : input.annotations.filter(
          (annotation) =>
            annotation.sourceDocumentId === input.activeDocumentId,
        ),
    [input.activeDocumentId, input.annotations, showAll],
  );

  return (
    <section aria-label="원고 주석" className="manuscript-annotations-panel">
      <header className="manuscript-annotations-panel-header">
        <div>
          <h4>주석</h4>
          <span>{visible.length}</span>
        </div>
        <button
          aria-pressed={showAll}
          className="manuscript-annotations-show-all"
          onClick={() => setShowAll((current) => !current)}
          type="button"
        >
          {showAll ? "현재 회차 보기" : "주석만 모아보기"}
        </button>
      </header>

      {!input.hasSelection && body.length === 0 && tags.length === 0 ? (
        <p className="manuscript-annotation-selection-hint">원고를 선택하면 그 구간에 주석을 붙일 수 있습니다.</p>
      ) : <div className="manuscript-annotation-composer">
        <p>
          {input.hasSelection
            ? "선택한 원고 구간에 주석을 붙입니다."
            : "원고에서 문장이나 구간을 먼저 선택하세요."}
        </p>
        <textarea
          aria-label="새 주석"
          onChange={(event) => setBody(event.target.value)}
          placeholder="주석 입력"
          rows={3}
          value={body}
        />
        <AnnotationTagsEditor onChange={setTags} tags={tags} />
        <button
          className="create-event-button"
          disabled={!input.hasSelection || input.busy}
          onClick={() => {
            void input.onCreate(body, tags).then((created) => {
              if (created !== null) {
                setBody("");
                setTags([]);
              }
            });
          }}
          type="button"
        >
          선택에 주석 추가
        </button>
      </div>}

      {input.error !== null && (
        <p className="event-action-error" role="alert">
          {input.error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="manuscript-annotation-empty">
          {showAll ? "작품에 저장된 주석이 없습니다." : "현재 회차에 주석이 없습니다."}
        </p>
      ) : (
        <ol className="manuscript-annotation-list">
          {visible.map((annotation) => {
            const editing = editingId === annotation.annotationId;
            return (
              <li key={annotation.annotationId}>
                <article
                  className="manuscript-annotation-card"
                  data-annotation-integrity={annotation.integrity}
                >
                  <header>
                    <strong>
                      {input.documentTitles[annotation.sourceDocumentId] ?? "회차"}
                    </strong>
                    <span>
                      {annotation.integrity === "resolved"
                        ? "연결됨"
                        : annotation.integrity === "needsReview"
                          ? "위치 확인 필요"
                          : "연결 끊김"}
                    </span>
                  </header>
                  <button
                    className="manuscript-annotation-quote"
                    disabled={
                      annotation.range === null ||
                      annotation.sourceDocumentId !== input.activeDocumentId
                    }
                    onClick={() => input.onOpen(annotation)}
                    type="button"
                  >
                    “{annotation.exactText}”
                  </button>
                  {editing ? (
                    <div className="manuscript-annotation-edit-form">
                      <textarea
                        aria-label="주석 수정"
                        onChange={(event) => setEditingBody(event.target.value)}
                        rows={3}
                        value={editingBody}
                      />
                      <AnnotationTagsEditor
                        onChange={setEditingTags}
                        tags={editingTags}
                      />
                      <div>
                        <button
                          disabled={input.busy}
                          onClick={() => {
                            void input.onUpdate(annotation, {
                              body: editingBody,
                              tags: editingTags,
                            }).then((updated) => {
                              if (updated !== null) setEditingId(null);
                            });
                          }}
                          type="button"
                        >
                          저장
                        </button>
                        <button
                          disabled={input.busy}
                          onClick={() => setEditingId(null)}
                          type="button"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {annotation.body.length > 0 && <p>{annotation.body}</p>}
                      {annotation.tags.length > 0 && (
                        <ul className="manuscript-annotation-tags">
                          {annotation.tags.map((tag) => (
                            <li key={tag}>{tag}</li>
                          ))}
                        </ul>
                      )}
                      <div className="manuscript-annotation-card-actions">
                        <button
                          disabled={input.busy}
                          onClick={() => {
                            setEditingId(annotation.annotationId);
                            setEditingBody(annotation.body);
                            setEditingTags(annotation.tags);
                          }}
                          type="button"
                        >
                          편집
                        </button>
                        <button
                          disabled={input.busy}
                          onClick={() => {
                            void input.onRetire(annotation);
                          }}
                          type="button"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
