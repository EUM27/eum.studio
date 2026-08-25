# T059 AssistantController sequence

Assistant state has three lifetimes: renderer-safe global connection/OAuth catalog, App-mount ephemeral chat, and Work+conversation context ledger. Assistant context projection owns grants, receipts, vocabulary/notation/suggestion/setting findings. Those findings are read-only; there is no Assistant approval/apply API, and canonical character/scene/publishing Candidate decisions remain their feature owners.

## Safe order

1. Ephemeral chat only.
2. Context loader, shared conversation ID, destination/context projections and stale sequence.
3. Grant/revoke plus exact refresh.
4. Generic connection projection/profile/CRUD while preserving credential secrecy.
5. Local vocabulary/notation/setting review and navigation ports.
6. External vocabulary/settings with exact manuscript port.
7. Cross-feature permission port.
8. OAuth/global connection consolidation with Shell and Publishing last.

The first Worker moves messages/sending/error/runChat to an injected hook. Preserve optimistic user append before command, exact full message history, assistant append, user message retained on failure, raw Error.message/generic fallback, one sending gate, in-memory non-Work-scoped history. Dialog visibility, OAuth, connections, permissions, Candidates, navigation, and settings remain App-owned.

## Security and behavior

- OAuth credentials/refresh/login/upstream remain main/platform; renderer receives status only.
- Generic credential plaintext exists only in the explicit form command; list projection exposes configured status.
- Receipts store ranges/counts/grant IDs, not raw manuscripts. Local tools transmit zero externally; external tools send only approved exact ranges/settings.
- Once grants may be consumed before connector/Candidate persistence; no rollback/retry if later work fails.
- Chat never reads manuscript context or bypasses permission ledgers.
- Context open stays one Promise.all with sequence-based stale-response suppression. Mutation refresh failure never rolls back the mutation.
- Keep the current vocabulary-lookup capability reuse for notation/suggestion.
- Do not silently fix Shell-login-to-Workspace status propagation or make chat durable/Work-scoped.
