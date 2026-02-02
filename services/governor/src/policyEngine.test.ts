import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "./policyEngine.js";
import { DEFAULT_POLICY, type ActionProposal } from "@agent-governor/shared";

const baseProposal: ActionProposal = {
  id: "p-1",
  timestamp: new Date().toISOString(),
  agentId: "agent-1",
  actionType: "TRANSFER",
  intent: "Test transfer",
  params: { amountUSDC: 1, to: DEFAULT_POLICY.allowlistRecipients[0] },
  context: { wallet: { balanceUSDC: 100 } }
};

describe("policyEngine", () => {
  it("denies transfer above max single transfer", () => {
    const proposal = {
      ...baseProposal,
      params: { amountUSDC: DEFAULT_POLICY.maxSingleTransferUSDC + 10, to: "0xSAFE_ALLOWLIST_1" }
    };
    const result = evaluatePolicy(proposal, DEFAULT_POLICY, 0);
    expect(result.hits.some((hit) => hit.ruleId === "maxSingleTransferUSDC")).toBe(true);
    expect(result.hits.some((hit) => hit.severity === "DENY")).toBe(true);
  });

  it("flags non-allowlisted recipient", () => {
    const proposal = {
      ...baseProposal,
      params: { amountUSDC: 5, to: "0xUNKNOWN" }
    };
    const result = evaluatePolicy(proposal, DEFAULT_POLICY, 0);
    expect(result.hits.some((hit) => hit.ruleId === "allowlistRecipients")).toBe(true);
  });

  it("flags swap slippage above max", () => {
    const proposal: ActionProposal = {
      ...baseProposal,
      actionType: "SWAP",
      intent: "Swap test",
      params: { slippageBps: DEFAULT_POLICY.swapMaxSlippageBps + 25 },
      context: { market: { liquidityUSDC: DEFAULT_POLICY.swapMinLiquidityUSDC + 1 } }
    };
    const result = evaluatePolicy(proposal, DEFAULT_POLICY, 0);
    expect(result.hits.some((hit) => hit.ruleId === "swapMaxSlippageBps")).toBe(true);
  });

  it("denies deploy when tests fail", () => {
    const proposal: ActionProposal = {
      ...baseProposal,
      actionType: "DEPLOY_SIM",
      intent: "Deploy test",
      params: {},
      context: { repo: { testsPassing: false } }
    };
    const result = evaluatePolicy(proposal, DEFAULT_POLICY, 0);
    expect(result.hits.some((hit) => hit.ruleId === "deployRequiresTestsPassing")).toBe(
      true
    );
  });
});
