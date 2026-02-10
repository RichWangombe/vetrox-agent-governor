import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { z } from "zod";
import {
  type ActionProposal,
  scoreRisk
} from "@agent-governor/shared";
import { loadPolicy, savePolicy, validatePolicy } from "./policyStore.js";
import { evaluatePolicy } from "./policyEngine.js";
import { judgeWithGemini } from "./geminiJudge.js";
import { composeDecision } from "./decision.js";
import {
  insertAudit,
  listAudit,
  getAudit,
  getAuditSummary,
  getDailySpendUSDC,
  verifyAuditChain
} from "./auditStore.js";
import { createAuth } from "./auth.js";

const rootEnvPath = path.resolve(process.cwd(), "..", "..", ".env");
dotenv.config({ path: existsSync(rootEnvPath) ? rootEnvPath : undefined });

const proposalSchema: z.ZodType<ActionProposal> = z.object({
  id: z.string(),
  timestamp: z.string(),
  agentId: z.string(),
  actionType: z.enum(["TRANSFER", "SWAP", "DEPLOY_SIM", "API_CALL"]),
  intent: z.string(),
  params: z.record(z.unknown()),
  context: z.object({
    market: z.record(z.unknown()).optional(),
    wallet: z.record(z.unknown()).optional(),
    repo: z.record(z.unknown()).optional(),
    api: z.record(z.unknown()).optional()
  })
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const auth = createAuth(process.env.GOVERNOR_API_KEYS);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "governor" });
});

app.get("/model", (_req, res) => {
  const model = process.env.GEMINI_MODEL ?? "unknown";
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  const mock = process.env.GEMINI_MOCK === "true" || !hasKey;
  res.json({ model, mock, hasKey });
});

app.get("/auth/status", (_req, res) => {
  res.json({ enabled: auth.enabled });
});

app.get("/policy", auth.requireRole(["admin", "operator", "auditor"]), async (_req, res) => {
  const policy = await loadPolicy();
  res.json(policy);
});

app.put("/policy", auth.requireRole(["admin"]), async (req, res) => {
  try {
    const policy = validatePolicy(req.body);
    await savePolicy(policy);
    res.json(policy);
  } catch (error) {
    res.status(400).json({ error: "Invalid policy payload." });
  }
});

app.get("/audit", auth.requireRole(["admin", "auditor"]), (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);
  res.json(listAudit(limit, offset));
});

app.get("/audit/verify", auth.requireRole(["admin", "auditor"]), (req, res) => {
  const limit = Number(req.query.limit ?? 1000);
  res.json(verifyAuditChain(limit));
});

app.get("/audit/:id", auth.requireRole(["admin", "auditor"]), (req, res) => {
  const id = Number(req.params.id);
  const entry = getAudit(id);
  if (!entry) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(entry);
});

app.post("/proposals", auth.requireRole(["admin", "operator"]), async (req, res) => {
  const start = Date.now();
  const parsed = proposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid proposal payload." });
    return;
  }

  const proposal = parsed.data;
  const policy = await loadPolicy();
  const dailySpendUSDC = getDailySpendUSDC(24);
  const evaluation = evaluatePolicy(proposal, policy, dailySpendUSDC);
  const auditSummary = getAuditSummary(10);
  const gemini = await judgeWithGemini(proposal, policy, auditSummary);
  const riskScore = scoreRisk(proposal, policy, { dailySpendUSDC });
  const decision = composeDecision(
    proposal,
    policy,
    evaluation,
    gemini.recommendation,
    riskScore
  );
  const latency = Date.now() - start;
  const auditId = insertAudit(proposal, decision, latency, gemini.raw);

  res.json({ ...decision, auditId });
});

const port = Number(process.env.GOVERNOR_PORT ?? 4000);
app.listen(port, () => {
  console.log(`Governor listening on http://localhost:${port}`);
});
