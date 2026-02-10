import React, { useEffect, useMemo, useState } from "react";

type AuditEntry = {
  id: number;
  proposalId: string;
  createdAt: string;
  decision: string;
  proposal: {
    actionType: string;
    intent: string;
    params: Record<string, unknown>;
  };
  decisionPayload: {
    decision: string;
    riskScore: number;
    policyHits: string[];
    explanation: string;
    requiredEdits?: string[];
    safeAlternative?: string;
  };
  latencyMs: number;
  geminiRaw?: string;
};

type ModelInfo = {
  model: string;
  mock: boolean;
  hasKey: boolean;
};

type StreamStatus = "live" | "paused" | "offline";
type HealthStatus = "online" | "offline" | "checking";
type DetailTab = "summary" | "json";

const GOVERNOR_URL =
  import.meta.env.VITE_GOVERNOR_URL ?? "http://localhost:4000";
const GOVERNOR_API_KEY = import.meta.env.VITE_GOVERNOR_API_KEY ?? "";

const ACTION_OPTIONS = ["ALL", "TRANSFER", "SWAP", "DEPLOY_SIM", "API_CALL"];
const DECISION_OPTIONS = ["ALL", "APPROVE", "DENY", "REQUIRE_CONFIRMATION"];

const buildHeaders = (): HeadersInit | undefined => {
  if (!GOVERNOR_API_KEY) return undefined;
  return { "x-api-key": GOVERNOR_API_KEY };
};

const timeAgo = (iso: string) => {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "unknown";
  const diff = Math.max(0, Date.now() - time);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const App: React.FC = () => {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("offline");
  const [health, setHealth] = useState<HealthStatus>("checking");
  const [lastUpdate, setLastUpdate] = useState<string>("—");
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [decisionFilter, setDecisionFilter] = useState("ALL");
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [copied, setCopied] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const latest = useMemo(() => audit[0], [audit]);

  const filteredAudit = useMemo(() => {
    const query = search.trim().toLowerCase();
    return audit.filter((entry) => {
      const matchesAction =
        actionFilter === "ALL" || entry.proposal.actionType === actionFilter;
      const matchesDecision =
        decisionFilter === "ALL" || entry.decision === decisionFilter;
      const matchesSearch =
        !query ||
        entry.proposal.intent.toLowerCase().includes(query) ||
        entry.proposalId.toLowerCase().includes(query) ||
        String(entry.id).includes(query);
      return matchesAction && matchesDecision && matchesSearch;
    });
  }, [audit, actionFilter, decisionFilter, search]);

  useEffect(() => {
    if (!showOnboarding && audit.length === 0) {
      setShowOnboarding(true);
    }
    if (showOnboarding && audit.length > 0) {
      setShowOnboarding(false);
    }
  }, [audit.length, showOnboarding]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (paused) {
        setStreamStatus("paused");
        return;
      }
      try {
        const response = await fetch(`${GOVERNOR_URL}/audit?limit=50`, {
          headers: buildHeaders()
        });
        if (!response.ok) throw new Error("Failed to fetch audit log");
        const data = (await response.json()) as AuditEntry[];
        if (!active) return;
        setAudit(data);
        setStreamStatus("live");
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (error) {
        if (!active) return;
        setStreamStatus("offline");
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [paused]);

  useEffect(() => {
    if (!filteredAudit.length) return;
    if (!selected || !filteredAudit.some((entry) => entry.id === selected.id)) {
      setSelected(filteredAudit[0]);
    }
  }, [filteredAudit, selected]);

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const response = await fetch(`${GOVERNOR_URL}/health`, {
          headers: buildHeaders()
        });
        if (!active) return;
        setHealth(response.ok ? "online" : "offline");
      } catch {
        if (!active) return;
        setHealth("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadModel = async () => {
      try {
        const response = await fetch(`${GOVERNOR_URL}/model`, {
          headers: buildHeaders()
        });
        if (!response.ok) throw new Error("No model endpoint");
        const data = (await response.json()) as ModelInfo;
        if (!active) return;
        setModelInfo(data);
      } catch {
        if (!active) return;
        setModelInfo(null);
      }
    };
    loadModel();
    const interval = setInterval(loadModel, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const copyCommand = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  };

  const geminiStatus = modelInfo
    ? modelInfo.mock
      ? "Mock"
      : "Real"
    : "Unknown";
  const modelName = modelInfo?.model ?? "unknown";

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>Agent Governor</h1>
          <p>Policy brain + audit ledger for autonomous systems</p>
        </div>
        <div className="status-grid">
          <div className={`status-card ${health}`}>
            <span>Governor</span>
            <strong>{health === "online" ? "Online" : "Offline"}</strong>
            <em>{streamStatus === "live" ? `Updated ${lastUpdate}` : streamStatus}</em>
          </div>
          <div className="status-card">
            <span>Gemini</span>
            <strong>{geminiStatus}</strong>
            <em>{modelInfo?.hasKey ? "Key loaded" : "Key missing"}</em>
          </div>
          <div className="status-card">
            <span>Model</span>
            <strong>{modelName}</strong>
            <em>Core reasoning engine</em>
          </div>
        </div>
      </header>

      {showOnboarding && (
        <section className="onboarding">
          <div className="onboarding-header">
            <div>
              <h2>Quick Start</h2>
              <p>Launch the services and watch your agent loop come alive.</p>
            </div>
            <button
              className="link"
              onClick={() => setShowOnboarding(false)}
            >
              Hide
            </button>
          </div>
          <div className="steps">
            <div className="step">
              <span className="step-num">1</span>
              <div>
                <strong>Start Governor</strong>
                <div className="command-row">
                  <code>pnpm governor:run</code>
                  <button
                    className="copy"
                    onClick={() => copyCommand("pnpm governor:run")}
                  >
                    {copied === "pnpm governor:run" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div className="step">
              <span className="step-num">2</span>
              <div>
                <strong>Start Worker</strong>
                <div className="command-row">
                  <code>pnpm worker:run</code>
                  <button
                    className="copy"
                    onClick={() => copyCommand("pnpm worker:run")}
                  >
                    {copied === "pnpm worker:run" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div className="step">
              <span className="step-num">3</span>
              <div>
                <strong>Start UI</strong>
                <div className="command-row">
                  <code>pnpm web:dev</code>
                  <button
                    className="copy"
                    onClick={() => copyCommand("pnpm web:dev")}
                  >
                    {copied === "pnpm web:dev" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Proposals</h2>
              <span className="muted">
                {filteredAudit.length} items • {paused ? "Paused" : "Live"}
              </span>
            </div>
            <button
              className={`toggle ${paused ? "active" : ""}`}
              onClick={() => setPaused((prev) => !prev)}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
          <div className="controls">
            <input
              className="input"
              placeholder="Search by intent or proposal ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="select"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={decisionFilter}
              onChange={(event) => setDecisionFilter(event.target.value)}
            >
              {DECISION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="list">
            {filteredAudit.map((entry) => (
              <button
                key={entry.id}
                className={`card ${
                  selected?.id === entry.id ? "active" : ""
                }`}
                onClick={() => setSelected(entry)}
              >
                <div>
                  <span className="tag">{entry.proposal.actionType}</span>
                  <h3>{entry.proposal.intent}</h3>
                  <div className="meta-line">
                    <span>{timeAgo(entry.createdAt)}</span>
                    <span>Risk {entry.decisionPayload.riskScore}</span>
                  </div>
                </div>
                <span className={`pill ${entry.decision.toLowerCase()}`}>
                  {entry.decision}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel hero">
          <h2>Latest Decision</h2>
          {latest ? (
            <>
              <div className="decision">
                <span className={`pill ${latest.decision.toLowerCase()}`}>
                  {latest.decision}
                </span>
                <span className="score">
                  Risk {latest.decisionPayload.riskScore}
                </span>
              </div>
              <p className="explanation">
                {latest.decisionPayload.explanation}
              </p>
              {latest.decisionPayload.policyHits.length > 0 && (
                <div className="chips">
                  {latest.decisionPayload.policyHits.map((hit) => (
                    <span key={hit} className="chip">
                      {hit}
                    </span>
                  ))}
                </div>
              )}
              {latest.decisionPayload.safeAlternative && (
                <div className="alt">
                  <h4>Safe Alternative</h4>
                  <p>{latest.decisionPayload.safeAlternative}</p>
                </div>
              )}
            </>
          ) : (
            <p className="muted">Waiting for proposals...</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Audit Log</h2>
              <span className="muted">Inspect decisions and traceability</span>
            </div>
          </div>
          {selected ? (
            <>
              <div className="meta">
                <div>
                  <span className="muted">Audit ID</span>
                  <strong>{selected.id}</strong>
                </div>
                <div>
                  <span className="muted">Latency</span>
                  <strong>{selected.latencyMs} ms</strong>
                </div>
                <div>
                  <span className="muted">Created</span>
                  <strong>{timeAgo(selected.createdAt)}</strong>
                </div>
              </div>
              <div className="tabs">
                <button
                  className={`tab ${detailTab === "summary" ? "active" : ""}`}
                  onClick={() => setDetailTab("summary")}
                >
                  Summary
                </button>
                <button
                  className={`tab ${detailTab === "json" ? "active" : ""}`}
                  onClick={() => setDetailTab("json")}
                >
                  JSON
                </button>
              </div>
              {detailTab === "summary" ? (
                <div className="summary">
                  <div className="summary-row">
                    <span className="label">Intent</span>
                    <span>{selected.proposal.intent}</span>
                  </div>
                  <div className="summary-row">
                    <span className="label">Decision</span>
                    <span className={`pill ${selected.decision.toLowerCase()}`}>
                      {selected.decision}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="label">Risk Score</span>
                    <span>{selected.decisionPayload.riskScore}</span>
                  </div>
                  <div className="summary-row">
                    <span className="label">Policy Hits</span>
                    <span>
                      {selected.decisionPayload.policyHits.length > 0
                        ? selected.decisionPayload.policyHits.join(", ")
                        : "None"}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="label">Explanation</span>
                    <span>{selected.decisionPayload.explanation}</span>
                  </div>
                  {selected.decisionPayload.requiredEdits?.length ? (
                    <div className="summary-row">
                      <span className="label">Required Edits</span>
                      <span>
                        {selected.decisionPayload.requiredEdits.join("; ")}
                      </span>
                    </div>
                  ) : null}
                  {selected.decisionPayload.safeAlternative ? (
                    <div className="summary-row">
                      <span className="label">Safe Alternative</span>
                      <span>{selected.decisionPayload.safeAlternative}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              )}
            </>
          ) : (
            <p className="muted">Select a proposal to inspect.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default App;
