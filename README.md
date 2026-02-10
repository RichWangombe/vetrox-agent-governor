# Agent Governor

Policy brain + audit ledger for autonomous agents. Every action proposal must pass through the Governor, which enforces hard rules, asks Gemini for contextual judgment, scores risk, and writes an immutable audit trail.

## Why it wins
- **Autonomy**: Worker agent runs continuously without hand-holding.
- **Technical craft**: Modular policy + judgment + audit pipeline.
- **Innovation**: Governor of agents = invisible architecture.
- **Utility**: Prevents bad transfers, risky swaps, unsafe deploys, and PII leaks.

## Architecture
```
Worker Agent -> POST /proposals -> Governor
                             |-> Policy Engine (hard gates)
                             |-> Gemini Judge (contextual reasoning)
                             |-> Risk Score (deterministic)
                             |-> Audit Ledger (SQLite)
Web UI -> GET /audit, /policy -> live inspection
```

## Quickstart
```bash
pnpm install
copy .env.example .env
pnpm dev
```

Or run each service:
```bash
pnpm governor:run
pnpm worker:run
pnpm web:dev
```

Open the UI at `http://localhost:5173`.

### Gemini configuration
- Set `GEMINI_API_KEY` in `.env`.
- Set `GEMINI_MODEL` if desired (default: gemini-3-pro-preview).
- If no key is set, the governor uses a deterministic mock judge.

### API auth and roles
- Set `GOVERNOR_API_KEYS` as comma-separated `role=key` pairs.
- Roles: `admin`, `operator`, `auditor`.
- Example: `GOVERNOR_API_KEYS=admin=admin-secret,operator=worker-secret,auditor=ui-secret`
- Worker uses `WORKER_API_KEY` when calling `POST /proposals`.
- UI uses `VITE_GOVERNOR_API_KEY` for protected read endpoints.

## API
- `POST /proposals` -> returns `GovernorDecision`
- `GET /model` -> current model + mock/real status
- `GET /policy` -> current policy JSON
- `PUT /policy` -> replace policy JSON
- `GET /audit?limit=20&offset=0` -> audit log
- `GET /audit/:id` -> single audit entry
- `GET /audit/verify` -> audit chain integrity check

## 3-minute demo script
1. Start the stack: `pnpm dev`.
2. Open the UI. Watch the Worker propose actions automatically.
3. Highlight a risky transfer (large amount, unknown recipient). Governor should **DENY**.
4. Show the denial explanation + policy hits in the middle panel.
5. Wait for the Worker to re-propose a safer alternative. Governor **APPROVES**.
6. Show a risky swap (high slippage + low liquidity) -> **REQUIRE_CONFIRMATION** or **DENY**.
7. Show deploy simulation with failing tests -> **DENY**.
8. Open an audit entry JSON to demonstrate traceability.
9. Call `GET /audit/verify` to show tamper-evident chain validation.

## Philosophy of Design
We don't need more prompt-waiting bots. We need **agent governance**. The Governor exists to enforce invariants before actions hit money, code, or infrastructure. Hard policies provide deterministic safety, Gemini adds contextual judgment, and the audit ledger makes every decision accountable. The system is built to be composable, explainable, and future-proof for a world of autonomous actors.

## Tests
```bash
pnpm test
```
