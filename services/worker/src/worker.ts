import dotenv from "dotenv";
import type { ActionProposal, GovernorDecision } from "@agent-governor/shared";
import { proposalFactories } from "./proposals.js";
import { adaptProposal } from "./adapt.js";

dotenv.config();

const governorUrl = process.env.GOVERNOR_URL ?? "http://localhost:4000";
const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 4000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sendProposal = async (proposal: ActionProposal): Promise<GovernorDecision | null> => {
  try {
    const response = await fetch(`${governorUrl}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

const run = async () => {
  console.log(`Worker agent running. Governor: ${governorUrl}`);
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
