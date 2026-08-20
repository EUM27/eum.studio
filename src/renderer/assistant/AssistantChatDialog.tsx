import { Send, Settings, Sparkles, Wrench, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { AssistantChatMessage } from "../../application/assistant/assistant-chat";
import type { ChatGptOAuthConnectionStatus } from "../../application/assistant/chatgpt-oauth";

export function AssistantChatDialog(input: {
  readonly actionState: "idle" | "sending";
  readonly error: string | null;
  readonly messages: readonly AssistantChatMessage[];
  readonly oauthStatus: ChatGptOAuthConnectionStatus | null;
  readonly onClose: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenTools: () => void;
  readonly onSend: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const connected = input.oauthStatus?.connected === true;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = message.trim();
    if (!connected || input.actionState !== "idle" || normalized.length === 0) {
      return;
    }
    input.onSend(normalized);
    setMessage("");
  }

  return (
    <div className="dialog-backdrop assistant-chat-backdrop">
      <section aria-label="GPT 조수 대화" className="assistant-chat-dialog" role="dialog">
        <header>
          <div>
            <Sparkles aria-hidden="true" size={18} />
            <span>
              <strong>조수</strong>
              <small>{connected ? input.oauthStatus?.displayName : "GPT 연결 필요"}</small>
            </span>
          </div>
          <div>
            <button onClick={input.onOpenTools} type="button">
              <Wrench aria-hidden="true" size={14} />
              원고 도구
            </button>
            <button aria-label="조수 대화 닫기" onClick={input.onClose} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        </header>

        {!connected && (
          <div className="assistant-chat-connection" role="status">
            <span>GPT와 대화하려면 로그인이 필요합니다.</span>
            <button onClick={input.onOpenSettings} type="button">
              <Settings aria-hidden="true" size={14} />
              로그인 설정
            </button>
          </div>
        )}

        <div aria-label="대화 내용" className="assistant-chat-messages">
          {input.messages.length === 0 ? (
            <p>메시지를 보내면 GPT 응답이 여기에 표시됩니다.</p>
          ) : (
            <ol>
              {input.messages.map((entry, index) => (
                <li className={`is-${entry.role}`} key={`${entry.role}:${index}`}>
                  <span>{entry.role === "user" ? "나" : "조수"}</span>
                  <p>{entry.text}</p>
                </li>
              ))}
              {input.actionState === "sending" && (
                <li className="is-assistant is-pending">
                  <span>조수</span>
                  <p>응답을 기다리는 중…</p>
                </li>
              )}
            </ol>
          )}
        </div>
        {input.error !== null && (
          <p className="assistant-chat-error" role="alert">{input.error}</p>
        )}
        <form className="assistant-chat-composer" onSubmit={submit}>
          <label>
            <span className="visually-hidden">GPT에게 보낼 메시지</span>
            <textarea
              aria-label="GPT에게 보낼 메시지"
              disabled={!connected || input.actionState !== "idle"}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={connected ? "메시지를 입력하세요" : "설정에서 GPT로 로그인하세요"}
              rows={3}
              value={message}
            />
          </label>
          <button
            aria-label="GPT에게 보내기"
            disabled={!connected || input.actionState !== "idle" || message.trim().length === 0}
            type="submit"
          >
            <Send aria-hidden="true" size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}
