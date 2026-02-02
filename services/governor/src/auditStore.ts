import Database from "better-sqlite3";
import path from "path";
import type { ActionProposal, AuditEntry, GovernorDecision } from "@agent-governor/shared";

const dbPath = path.resolve(process.cwd(), "audit.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposalId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    decision TEXT NOT NULL,
    proposalJson TEXT NOT NULL,
    decisionJson TEXT NOT NULL,
    latencyMs INTEGER NOT NULL,
    geminiRaw TEXT
  )
`);

const mapRow = (row: any): AuditEntry => ({
  id: row.id,
  proposalId: row.proposalId,
  createdAt: new Date(row.createdAt).toISOString(),
  decision: row.decision,
  proposal: JSON.parse(row.proposalJson),
  decisionPayload: JSON.parse(row.decisionJson),
  latencyMs: row.latencyMs,
  geminiRaw: row.geminiRaw ?? undefined
});

export const insertAudit = (
  proposal: ActionProposal,
  decision: GovernorDecision,
  latencyMs: number,
  geminiRaw?: string
) => {
  const stmt = db.prepare(
    `INSERT INTO audit (proposalId, createdAt, decision, proposalJson, decisionJson, latencyMs, geminiRaw)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const createdAt = Date.now();
  const info = stmt.run(
    proposal.id,
    createdAt,
    decision.decision,
    JSON.stringify(proposal),
    JSON.stringify(decision),
    latencyMs,
    geminiRaw ?? null
  );
  return Number(info.lastInsertRowid);
};

export const listAudit = (limit = 20, offset = 0): AuditEntry[] => {
  const stmt = db.prepare(
    `SELECT * FROM audit ORDER BY id DESC LIMIT ? OFFSET ?`
  );
  const rows = stmt.all(limit, offset);
  return rows.map(mapRow);
};

export const getAudit = (id: number): AuditEntry | null => {
  const stmt = db.prepare(`SELECT * FROM audit WHERE id = ?`);
  const row = stmt.get(id);
  return row ? mapRow(row) : null;
};

export const getAuditSummary = (limit = 10) => {
  const stmt = db.prepare(
    `SELECT decision, proposalId, createdAt FROM audit ORDER BY id DESC LIMIT ?`
  );
  const rows = stmt.all(limit);
  const counts = rows.reduce<Record<string, number>>((acc, row: any) => {
    acc[row.decision] = (acc[row.decision] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: rows.length,
    counts,
    recent: rows.map((row: any) => ({
      proposalId: row.proposalId,
      decision: row.decision,
      createdAt: new Date(row.createdAt).toISOString()
    }))
  };
};

export const getDailySpendUSDC = (hours = 24) => {
  const since = Date.now() - hours * 60 * 60 * 1000;
  const stmt = db.prepare(
    `SELECT proposalJson, decisionJson, createdAt FROM audit WHERE createdAt >= ?`
  );
  const rows = stmt.all(since);
  let total = 0;
  for (const row of rows) {
    try {
      const proposal = JSON.parse(row.proposalJson) as ActionProposal;
      const decision = JSON.parse(row.decisionJson) as GovernorDecision;
      if (decision.decision !== "APPROVE") continue;
      if (proposal.actionType !== "TRANSFER") continue;
      const amount = Number(proposal.params.amountUSDC ?? proposal.params.amount ?? 0);
      total += amount;
    } catch {
      continue;
    }
  }
  return total;
};
