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

const GOVERNOR_URL =
  import.meta.env.VITE_GOVERNOR_URL ?? "http://localhost:4000";

const App: React.FC = () => {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [status, setStatus] = useState<string>("connecting");

  const latest = useMemo(() => audit[0], [audit]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${GOVERNOR_URL}/audit?limit=30`);
        if (!response.ok) throw new Error("Failed to fetch audit log");
        const data = (await response.json()) as AuditEntry[];
        if (!active) return;
        setAudit(data);
        setStatus(`updated ${new Date().toLocaleTimeString()}`);
        if (!selected && data.length > 0) setSelected(data[0]);
      } catch (error) {
        if (!active) return;
        setStatus("offline");
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selected]);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>Agent Governor</h1>
          <p>Policy brain + audit ledger for autonomous systems</p>
        </div>
        <div className="status">
          <span>Governor</span>
          <strong>{status}</strong>
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <h2>Proposals</h2>
          <div className="list">
            {audit.map((entry) => (
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
          <h2>Audit Log</h2>
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
              </div>
              <pre>{JSON.stringify(selected, null, 2)}</pre>
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
