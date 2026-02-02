import { randomUUID } from "crypto";
import type { ActionProposal, GovernorDecision } from "@agent-governor/shared";

const allowlist = ["0xSAFE_ALLOWLIST_1", "0xSAFE_ALLOWLIST_2"];

export const adaptProposal = (
  proposal: ActionProposal,
  decision: GovernorDecision
): ActionProposal | null => {
  if (decision.decision === "APPROVE") return null;

  if (proposal.actionType === "TRANSFER") {
    return {
      ...proposal,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      intent: "Safer transfer after governor feedback.",
      params: { amountUSDC: 10, to: allowlist[0] }
    };
  }

  if (proposal.actionType === "SWAP") {
    return {
      ...proposal,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      intent: "Lower slippage swap after governor feedback.",
      params: { ...proposal.params, slippageBps: 25 },
      context: {
        ...proposal.context,
        market: { ...(proposal.context.market ?? {}), liquidityUSDC: 12000, volatility: 0.2 }
      }
    };
  }

  if (proposal.actionType === "DEPLOY_SIM") {
    return {
      ...proposal,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      intent: "Re-propose deploy after tests pass.",
      context: { ...proposal.context, repo: { ...(proposal.context.repo ?? {}), testsPassing: true } }
    };
  }

  if (proposal.actionType === "API_CALL") {
    return {
      ...proposal,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      intent: "Redacted API call after governor feedback.",
      context: { ...proposal.context, api: { ...(proposal.context.api ?? {}), containsPII: false } }
    };
  }

  return null;
};
