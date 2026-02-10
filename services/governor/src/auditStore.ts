import Database from "better-sqlite3";
import path from "path";
import { createHash } from "crypto";
import type { ActionProposal, AuditEntry, GovernorDecision } from "@agent-governor/shared";

interface AuditRow {
  id: number;
  proposalId: string;
  createdAt: number;
  decision: string;
  proposalJson: string;
  decisionJson: string;
  latencyMs: number;
  geminiRaw: string | null;
  prevHash: string | null;
  entryHash: string | null;
}

interface SummaryRow {
  decision: string;
  proposalId: string;
  createdAt: number;
}

interface SpendRow {
  proposalJson: string;
  decisionJson: string;
}

interface ChainRow {
  id: number;
  proposalId: string;
  createdAt: number;
  proposalJson: string;
  decisionJson: string;
  latencyMs: number;
  geminiRaw: string | null;
  prevHash: string | null;
  entryHash: string | null;
}

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

const tableInfo = db.prepare("PRAGMA table_info(audit)").all() as Array<{ name: string }>;
const existingColumns = new Set(tableInfo.map((column) => column.name));
if (!existingColumns.has("prevHash")) {
  db.exec("ALTER TABLE audit ADD COLUMN prevHash TEXT");
}
if (!existingColumns.has("entryHash")) {
  db.exec("ALTER TABLE audit ADD COLUMN entryHash TEXT");
}

const normalizeNullable = (value: string | null): string => value ?? "";

const computeEntryHash = (input: {
  proposalId: string;
  createdAt: number;
  proposalJson: string;
  decisionJson: string;
  latencyMs: number;
  geminiRaw: string | null;
  prevHash: string;
}) => {
  const payload = [
    input.proposalId,
    String(input.createdAt),
    input.proposalJson,
    input.decisionJson,
    String(input.latencyMs),
    normalizeNullable(input.geminiRaw),
    input.prevHash
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
};

const backfillMissingHashes = () => {
  const rows = db
    .prepare(
      `SELECT id, proposalId, createdAt, proposalJson, decisionJson, latencyMs, geminiRaw, prevHash, entryHash
       FROM audit
       ORDER BY id ASC`
    )
    .all() as ChainRow[];

  if (rows.length === 0) return;

  const updateStmt = db.prepare(
    `UPDATE audit SET prevHash = ?, entryHash = ? WHERE id = ?`
  );

  const tx = db.transaction(() => {
    let prevHash = "GENESIS";
    for (const row of rows) {
      if (row.prevHash && row.entryHash) {
        prevHash = row.entryHash;
        continue;
      }
      const entryHash = computeEntryHash({
        proposalId: row.proposalId,
        createdAt: row.createdAt,
        proposalJson: row.proposalJson,
        decisionJson: row.decisionJson,
        latencyMs: row.latencyMs,
        geminiRaw: row.geminiRaw,
        prevHash
      });
      updateStmt.run(prevHash, entryHash, row.id);
      prevHash = entryHash;
    }
  });

  tx();
};

backfillMissingHashes();

const mapRow = (row: AuditRow): AuditEntry => {
  const proposal = JSON.parse(row.proposalJson) as ActionProposal;
  const decisionPayload = JSON.parse(row.decisionJson) as GovernorDecision;
  return {
    id: row.id,
    proposalId: row.proposalId,
    createdAt: new Date(row.createdAt).toISOString(),
    decision: decisionPayload.decision,
    proposal,
    decisionPayload,
    latencyMs: row.latencyMs,
    geminiRaw: row.geminiRaw ?? undefined,
    prevHash: row.prevHash ?? undefined,
    entryHash: row.entryHash ?? undefined
  };
};

export const insertAudit = (
  proposal: ActionProposal,
  decision: GovernorDecision,
  latencyMs: number,
  geminiRaw?: string
) => {
  const previousHashRow = db
    .prepare(`SELECT entryHash FROM audit ORDER BY id DESC LIMIT 1`)
    .get() as { entryHash: string | null } | undefined;

  const stmt = db.prepare(
    `INSERT INTO audit (proposalId, createdAt, decision, proposalJson, decisionJson, latencyMs, geminiRaw, prevHash, entryHash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const createdAt = Date.now();
  const prevHash = previousHashRow?.entryHash ?? "GENESIS";
  const proposalJson = JSON.stringify(proposal);
  const decisionJson = JSON.stringify(decision);
  const entryHash = computeEntryHash({
    proposalId: proposal.id,
    createdAt,
    proposalJson,
    decisionJson,
    latencyMs,
    geminiRaw: geminiRaw ?? null,
    prevHash
  });

  const info = stmt.run(
    proposal.id,
    createdAt,
    decision.decision,
    proposalJson,
    decisionJson,
    latencyMs,
    geminiRaw ?? null,
    prevHash,
    entryHash
  );
  return Number(info.lastInsertRowid);
};

export const listAudit = (limit = 20, offset = 0): AuditEntry[] => {
  const stmt = db.prepare(
    `SELECT * FROM audit ORDER BY id DESC LIMIT ? OFFSET ?`
  );
  const rows = stmt.all(limit, offset) as AuditRow[];
  return rows.map(mapRow);
};

export const getAudit = (id: number): AuditEntry | null => {
  const stmt = db.prepare(`SELECT * FROM audit WHERE id = ?`);
  const row = stmt.get(id) as AuditRow | undefined;
  return row ? mapRow(row) : null;
};

export const getAuditSummary = (limit = 10) => {
  const stmt = db.prepare(
    `SELECT decision, proposalId, createdAt FROM audit ORDER BY id DESC LIMIT ?`
  );
  const rows = stmt.all(limit) as SummaryRow[];
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.decision] = (acc[row.decision] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: rows.length,
    counts,
    recent: rows.map((row) => ({
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
  const rows = stmt.all(since) as SpendRow[];
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

export const verifyAuditChain = (limit = 1000) => {
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 10000)) : 1000;
  const rows = db
    .prepare(
      `SELECT id, proposalId, createdAt, proposalJson, decisionJson, latencyMs, geminiRaw, prevHash, entryHash
       FROM audit
       ORDER BY id ASC
       LIMIT ?`
    )
    .all(boundedLimit) as ChainRow[];

  let expectedPrev = "GENESIS";
  for (const row of rows) {
    if (!row.prevHash || !row.entryHash) {
      return {
        valid: false,
        checked: rows.length,
        firstInvalidAuditId: row.id,
        reason: "Missing hash fields."
      };
    }
    if (row.prevHash !== expectedPrev) {
      return {
        valid: false,
        checked: rows.length,
        firstInvalidAuditId: row.id,
        reason: "prevHash mismatch."
      };
    }
    const recomputed = computeEntryHash({
      proposalId: row.proposalId,
      createdAt: row.createdAt,
      proposalJson: row.proposalJson,
      decisionJson: row.decisionJson,
      latencyMs: row.latencyMs,
      geminiRaw: row.geminiRaw,
      prevHash: row.prevHash
    });
    if (recomputed !== row.entryHash) {
      return {
        valid: false,
        checked: rows.length,
        firstInvalidAuditId: row.id,
        reason: "entryHash mismatch."
      };
    }
    expectedPrev = row.entryHash;
  }

  return {
    valid: true,
    checked: rows.length,
    tailHash: expectedPrev
  };
};
