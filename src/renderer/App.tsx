import { useEffect, useState } from "react";

import type { RuntimeInfo } from "../application/contracts/studio-bridge";

type RuntimeState =
  | { status: "loading" }
  | { status: "ready"; info: RuntimeInfo }
  | { status: "error" };

export function App() {
  const [runtime, setRuntime] = useState<RuntimeState>({ status: "loading" });

  useEffect(() => {
    let disposed = false;

    window.eumStudio.system.getRuntimeInfo().then(
      (info) => {
        if (!disposed) {
          setRuntime({ status: "ready", info });
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
    <main className="gate-shell">
      <section aria-labelledby="studio-title" className="gate-card">
        <p className="gate-label">Gate 0</p>
        <h1 id="studio-title">이음 스튜디오</h1>
        <p>새 데스크톱 기반과 프로세스 경계를 검증하는 진단 셸입니다.</p>
        <p aria-live="polite" data-testid="runtime-status">
          {runtime.status === "loading" && "런타임 확인 중"}
          {runtime.status === "error" && "런타임 연결 실패"}
          {runtime.status === "ready" &&
            `연결됨 · ${runtime.info.platform} · ${runtime.info.architecture}`}
        </p>
      </section>
    </main>
  );
}
