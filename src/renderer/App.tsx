import { useCallback, useEffect, useState } from "react";

import type { RuntimeInfo } from "../application/contracts/studio-bridge";
import type { ManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import { ManuscriptEditor } from "./editor/ManuscriptEditor";
import type { ManuscriptTransaction } from "./editor/manuscript-transaction";

type RuntimeState =
  | { status: "loading" }
  | {
      status: "ready";
      info: RuntimeInfo;
      inputProfile: ManuscriptInputProfile;
    }
  | { status: "error" };

export function App() {
  const [runtime, setRuntime] = useState<RuntimeState>({ status: "loading" });
  const [manuscriptLength, setManuscriptLength] = useState(0);
  const [selectionLength, setSelectionLength] = useState(0);

  const handleManuscriptTransaction = useCallback(
    (transaction: ManuscriptTransaction) => {
      setManuscriptLength(transaction.afterLength);
      setSelectionLength(
        transaction.selection.ranges.reduce(
          (length, range) => length + (range.to - range.from),
          0,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    let disposed = false;

    Promise.all([
      window.eumStudio.system.getRuntimeInfo(),
      window.eumStudio.editor.getManuscriptInputProfile(),
    ]).then(
      ([info, inputProfile]) => {
        if (!disposed) {
          setRuntime({ status: "ready", info, inputProfile });
        }
      },
      () => {
        if (!disposed) {
          setRuntime({ status: "error" });
        }
      },
    );

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="studio-kicker">장편 편집기 POC</p>
          <h1>이음 스튜디오</h1>
        </div>
        <p
          aria-live="polite"
          className="runtime-status"
          data-testid="runtime-status"
        >
          {runtime.status === "loading" && "런타임 확인 중"}
          {runtime.status === "error" && "런타임 연결 실패"}
          {runtime.status === "ready" &&
            `연결됨 · ${runtime.info.platform} · ${runtime.info.architecture}`}
        </p>
      </header>
      <section
        aria-labelledby="manuscript-heading"
        className="writing-workspace"
      >
        <header className="manuscript-header">
          <div>
            <p className="manuscript-context">로컬 편집 표면</p>
            <h2 id="manuscript-heading">원고</h2>
          </div>
          <p aria-live="polite" className="manuscript-count">
            <output data-testid="manuscript-length">
              {manuscriptLength}
            </output>
            <span>자</span>
            {selectionLength > 0 && (
              <span className="selection-count">
                <span aria-hidden="true">·</span>
                <span>선택 </span>
                <output data-testid="manuscript-selection-length">
                  {selectionLength}
                </output>
                <span>자</span>
              </span>
            )}
          </p>
        </header>
        {runtime.status === "ready" && (
          <ManuscriptEditor
            accessibleName="원고"
            initialText=""
            inputProfile={runtime.inputProfile}
            onTransaction={handleManuscriptTransaction}
          />
        )}
      </section>
    </main>
  );
}
