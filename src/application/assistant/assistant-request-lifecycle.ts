import { entityId, type EntityId } from "../../domain/writing";

export const ASSISTANT_REQUEST_FAILURE_REASONS = [
  "cancelled", "timeout", "server-error", "response-too-large", "invalid-response",
  "network-error", "configuration-error",
] as const;
export type AssistantRequestFailureReason = (typeof ASSISTANT_REQUEST_FAILURE_REASONS)[number];
export type AssistantRequestFailure = Readonly<{
  schemaVersion: 1; status: "failed"; reason: AssistantRequestFailureReason;
}>;
export const ASSISTANT_REQUEST_FAILURE_MESSAGES: Readonly<Record<AssistantRequestFailureReason, string>> = Object.freeze({
  cancelled: "조수 요청을 취소했습니다.",
  timeout: "조수 요청의 제한 시간이 지났습니다.",
  "server-error": "조수 서버가 요청을 처리하지 못했습니다.",
  "response-too-large": "조수 응답이 연결에 설정된 크기 제한을 초과했습니다.",
  "invalid-response": "조수 응답이 필요한 형식과 일치하지 않습니다.",
  "network-error": "조수 서버에 연결하지 못했습니다.",
  "configuration-error": "조수 연결의 요청 제한 설정을 확인하세요.",
});
export class AssistantRequestError extends Error {
  constructor(readonly code: AssistantRequestFailureReason, options?: ErrorOptions) {
    super(ASSISTANT_REQUEST_FAILURE_MESSAGES[code], options);
    this.name = "AssistantRequestError";
  }
}

export function parseAssistantOperationResponse<T>(value: unknown, parse: (value: unknown) => T): T {
  try {
    return parse(value);
  } catch (cause) {
    throw new AssistantRequestError("invalid-response", { cause });
  }
}
export type AssistantRequestPolicy = Readonly<{ timeoutMs: number; maxResponseBytes: number }>;

export function parseAssistantRequestPolicy(value: unknown): AssistantRequestPolicy {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AssistantRequestError("configuration-error");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || !Number.isSafeInteger(input.timeoutMs) || !Number.isSafeInteger(input.maxResponseBytes) ||
    (input.timeoutMs as number) <= 0 || (input.maxResponseBytes as number) <= 0) throw new AssistantRequestError("configuration-error");
  // JavaScript timers use a signed 32-bit delay; reject overflow instead of silently turning it into 1ms.
  if ((input.timeoutMs as number) > 2 ** 31 - 1) throw new AssistantRequestError("configuration-error");
  return Object.freeze({ timeoutMs: input.timeoutMs as number, maxResponseBytes: input.maxResponseBytes as number });
}

export function parseAssistantRequestFailure(value: unknown): AssistantRequestFailure {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid assistant request failure");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 3 || input.schemaVersion !== 1 || input.status !== "failed" ||
    !ASSISTANT_REQUEST_FAILURE_REASONS.includes(input.reason as AssistantRequestFailureReason)) throw new Error("Invalid assistant request failure");
  return Object.freeze({ schemaVersion: 1, status: "failed", reason: input.reason as AssistantRequestFailureReason });
}

export function throwIfAssistantRequestAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof AssistantRequestError ? signal.reason : new AssistantRequestError("cancelled");
}

export function waitForAssistantRequest<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return operation;
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      try { throwIfAssistantRequestAborted(signal); } catch (error) { reject(error); }
    };
    signal.addEventListener("abort", abort, { once: true });
    // Always attach rejection handling, even when already cancelled.
    operation.then((value) => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) abort(); else resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) abort(); else reject(error);
    });
    if (signal.aborted) abort();
  });
}

export async function withAssistantRequestLifetime<T>(input: {
  signal?: AbortSignal; timeoutMs?: number; execute: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  const deadline = input.timeoutMs === undefined ? undefined : performance.now() + input.timeoutMs;
  const cancel = () => controller.abort(input.signal?.reason instanceof AssistantRequestError ? input.signal.reason : new AssistantRequestError("cancelled"));
  input.signal?.addEventListener("abort", cancel, { once: true });
  if (input.signal?.aborted) cancel();
  const timer = input.timeoutMs === undefined ? undefined : setTimeout(() => controller.abort(new AssistantRequestError("timeout")), input.timeoutMs);
  try {
    throwIfAssistantRequestAborted(controller.signal);
    const result = await waitForAssistantRequest(input.execute(controller.signal), controller.signal);
    if (deadline !== undefined && performance.now() >= deadline) controller.abort(new AssistantRequestError("timeout"));
    throwIfAssistantRequestAborted(controller.signal);
    return result;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    input.signal?.removeEventListener("abort", cancel);
  }
}

export type CancelAssistantRequestCommand = Readonly<{
  schemaVersion: 1; workId: EntityId<"Work">; requestId: string;
}>;
export type CancelAssistantRequestResult = Readonly<{ schemaVersion: 1; status: "cancelled" | "not-running" }>;
export function parseCancelAssistantRequestCommand(value: unknown): CancelAssistantRequestCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid assistant cancellation command");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 3 || input.schemaVersion !== 1 || typeof input.workId !== "string" || !input.workId.trim() ||
    typeof input.requestId !== "string" || !input.requestId.trim()) throw new Error("Invalid assistant cancellation command");
  return Object.freeze({ schemaVersion: 1, workId: entityId<"Work">(input.workId), requestId: input.requestId });
}
export function parseCancelAssistantRequestResult(value: unknown): CancelAssistantRequestResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid assistant cancellation result");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || input.schemaVersion !== 1 || (input.status !== "cancelled" && input.status !== "not-running")) throw new Error("Invalid assistant cancellation result");
  return Object.freeze({ schemaVersion: 1, status: input.status });
}

/** Register before queueing. Cancellation is synchronous and never waits behind an external request. */
export class AssistantRequestRegistry {
  readonly #pending = new Map<string, { workId: EntityId<"Work">; controller: AbortController }>();
  async run<T>(identity: CancelAssistantRequestCommand, execute: (signal: AbortSignal) => Promise<T>): Promise<T | AssistantRequestFailure> {
    if (this.#pending.has(identity.requestId)) throw new Error("Assistant request is already running");
    const controller = new AbortController();
    this.#pending.set(identity.requestId, { workId: identity.workId, controller });
    try {
      return await waitForAssistantRequest(execute(controller.signal), controller.signal);
    } catch (error) {
      if (error instanceof AssistantRequestError) return Object.freeze({ schemaVersion: 1, status: "failed", reason: error.code });
      throw error;
    } finally {
      this.#pending.delete(identity.requestId);
    }
  }
  cancel(value: unknown): CancelAssistantRequestResult {
    const command = parseCancelAssistantRequestCommand(value);
    const pending = this.#pending.get(command.requestId);
    if (pending === undefined || pending.workId !== command.workId) return Object.freeze({ schemaVersion: 1, status: "not-running" });
    pending.controller.abort(new AssistantRequestError("cancelled"));
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
}
