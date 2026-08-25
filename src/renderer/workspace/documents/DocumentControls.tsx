import type { FormEvent } from "react";
import { Plus } from "lucide-react";

export function RenameTitleForm({
  itemLabel,
  value,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  readonly itemLabel: "작품" | "회차";
  readonly value: string;
  readonly submitting: boolean;
  readonly onChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitting && value.trim().length > 0) {
      onSubmit();
    }
  };

  return (
    <form
      aria-label={`${itemLabel} 이름 변경`}
      className="title-rename-form"
      onSubmit={handleSubmit}
    >
      <input
        aria-label={`${itemLabel} 새 이름`}
        autoFocus
        disabled={submitting}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      <button disabled={submitting} onClick={onCancel} type="button">
        취소
      </button>
      <button
        disabled={submitting || value.trim().length === 0}
        type="submit"
      >
        {submitting ? "저장 중" : "저장"}
      </button>
    </form>
  );
}

export function CreateDocumentControl({
  disabled,
  onCreate,
}: {
  readonly disabled: boolean;
  readonly onCreate: () => void;
}) {
  return (
    <span className="create-document-control">
      <button
        aria-label="새 회차"
        className="create-document-button"
        disabled={disabled}
        onClick={onCreate}
        title="새 회차"
        type="button"
      >
        <Plus aria-hidden="true" size={16} />
      </button>
    </span>
  );
}
