import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";
import type { ActionProposal, GovernorDecision } from "@agent-governor/shared";
import { proposalFactories } from "./proposals.js";
import { adaptProposal } from "./adapt.js";

const rootEnvPath = path.resolve(process.cwd(), "..", "..", ".env");
dotenv.config({ path: existsSync(rootEnvPath) ? rootEnvPath : undefined });

const governorUrl = process.env.GOVERNOR_URL ?? "http://localhost:4000";
const governorApiKey = process.env.WORKER_API_KEY ?? "";
const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 4000);
const waitIntervalMs = Number(process.env.WORKER_WAIT_INTERVAL_MS ?? 500);
const waitTimeoutMs = Number(process.env.WORKER_WAIT_TIMEOUT_MS ?? 60000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sendProposal = async (proposal: ActionProposal): Promise<GovernorDecision | null> => {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (governorApiKey) {
      headers["x-api-key"] = governorApiKey;
    }
    const response = await fetch(`${governorUrl}/proposals`, {
      method: "POST",
      headers,
      body: JSON.stringify(proposal)
    });
    if (!response.ok) {
      console.error("Governor rejected proposal", await response.text());
      return null;
    }
    const decision = (await response.json()) as GovernorDecision;
    console.log(
      `[${new Date().toISOString()}] ${proposal.actionType} -> ${decision.decision} (risk ${decision.riskScore})`
    );
    return decision;
  } catch (error) {
    console.error("Failed to reach governor", error);
    return null;
  }
};

const waitForGovernor = async () => {
  const timeoutEnabled = Number.isFinite(waitTimeoutMs) && waitTimeoutMs > 0;
  const deadline = timeoutEnabled ? Date.now() + waitTimeoutMs : Infinity;
  let attempt = 0;
  console.log("Waiting for governor health...");
  while (Date.now() <= deadline) {
    attempt += 1;
    try {
      const headers = governorApiKey ? { "x-api-key": governorApiKey } : undefined;
      const response = await fetch(`${governorUrl}/health`, { headers });
      if (response.ok) {
        console.log("Governor is healthy.");
        return;
      }
    } catch {
      // ignore until timeout
    }
    if (timeoutEnabled && Date.now() + waitIntervalMs > deadline) break;
    await sleep(waitIntervalMs);
  }
  if (timeoutEnabled) {
    console.warn(
      `Governor health check timed out after ${Math.round(waitTimeoutMs / 1000)}s. Continuing anyway.`
    );
  }
};

const run = async () => {
  console.log(`Worker agent running. Governor: ${governorUrl}`);
  await waitForGovernor();
  let index = 0;
  while (true) {
    const factory = proposalFactories[index % proposalFactories.length];
    const proposal = factory();
    const decision = await sendProposal(proposal);
    if (decision && decision.decision !== "APPROVE") {
      const safer = adaptProposal(proposal, decision);
      if (safer) {
        await sleep(1000);
        await sendProposal(safer);
      }
    }
    index += 1;
    await sleep(intervalMs);
  }
};

run();
