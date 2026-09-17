import { randomUUID } from "node:crypto";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { expect, it, vi } from "vitest";
import { entityId } from "../../domain/writing";
import { ASSISTANT_CANCEL_REQUEST_CHANNEL, createAssistantBridge } from "../../application/contracts/bridge/assistant-bridge";
import { registerAssistantIpc, type AssistantIpcRuntime } from "./register-assistant-ipc";

it("authorizes the exact cancellation IPC and parses command and response at the bridge", async () => {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, value: unknown) => unknown>();
  const cancelAssistantRequest = vi.fn(() => ({ schemaVersion: 1, status: "cancelled" }));
  const authorizeSender = vi.fn();
  registerAssistantIpc({
    ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } } as Pick<IpcMain, "handle">,
    authorizeSender, runtime: { cancelAssistantRequest } as unknown as AssistantIpcRuntime,
    oauth: {} as Parameters<typeof registerAssistantIpc>[0]["oauth"], runChat: vi.fn(),
  });
  const event = {} as IpcMainInvokeEvent;
  const invoke = vi.fn(async (channel: string, value?: unknown) => handlers.get(channel)?.(event, value));
  const bridge = createAssistantBridge(invoke);
  const command = { schemaVersion: 1 as const, workId: entityId<"Work">(randomUUID()), requestId: randomUUID() };
  await expect(bridge.cancelRequest(command)).resolves.toEqual({ schemaVersion: 1, status: "cancelled" });
  expect(invoke).toHaveBeenCalledWith(ASSISTANT_CANCEL_REQUEST_CHANNEL, command);
  expect(authorizeSender).toHaveBeenCalledWith(event);
  expect(cancelAssistantRequest).toHaveBeenCalledWith(command);
  authorizeSender.mockImplementationOnce(() => { throw new Error("untrusted sender"); });
  await expect(bridge.cancelRequest(command)).rejects.toThrow("untrusted sender");
  expect(cancelAssistantRequest).toHaveBeenCalledTimes(1);
  await expect(bridge.cancelRequest({ ...command, endpoint: randomUUID() } as typeof command)).rejects.toThrow("Invalid assistant cancellation command");
  expect(invoke).toHaveBeenCalledTimes(2);
  await expect(createAssistantBridge(async () => ({ schemaVersion: 1, status: "cancelled", secret: randomUUID() })).cancelRequest(command)).rejects.toThrow("Invalid assistant cancellation result");
});
