import type { ActionProposal } from "./types.js";
import type { Policy } from "./policy.js";

export interface RiskContext {
  dailySpendUSDC?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const scoreRisk = (
  proposal: ActionProposal,
  policy: Policy,
  context: RiskContext = {}
) => {
  let risk = 5;

  if (proposal.actionType === "TRANSFER") {
    const amount = Number(proposal.params.amountUSDC ?? proposal.params.amount ?? 0);
    const recipient = String(proposal.params.to ?? "");
    if (amount > policy.maxSingleTransferUSDC) risk += 25;
    if (amount > policy.maxDailySpendUSDC) risk += 15;
    if (policy.denylistRecipients.includes(recipient)) risk += 50;
    if (
      policy.allowlistRecipients.length > 0 &&
      !policy.allowlistRecipients.includes(recipient)
    ) {
      risk += 15;
    }
  }

  if (proposal.actionType === "SWAP") {
    const slippageBps = Number(proposal.params.slippageBps ?? 0);
    const liquidity = Number(proposal.context.market?.liquidityUSDC ?? 0);
    const volatility = Number(proposal.context.market?.volatility ?? 0);
    if (slippageBps > policy.swapMaxSlippageBps) risk += 20;
    if (liquidity < policy.swapMinLiquidityUSDC) risk += 20;
    if (volatility > 0.7) risk += 15;
  }

  if (proposal.actionType === "DEPLOY_SIM") {
    const testsPassing = Boolean(proposal.context.repo?.testsPassing ?? true);
    const filesChanged = Number(proposal.context.repo?.diffStat?.filesChanged ?? 0);
    if (!testsPassing) risk += 25;
    if (filesChanged > 30) risk += 10;
  }

  if (proposal.actionType === "API_CALL") {
    const containsPII = Boolean(proposal.context.api?.containsPII ?? false);
    const sensitivity = String(proposal.context.api?.sensitivity ?? "");
    if (containsPII) risk += 30;
    if (sensitivity === "high") risk += 15;
  }

  if (typeof context.dailySpendUSDC === "number") {
    const ratio = context.dailySpendUSDC / Math.max(policy.maxDailySpendUSDC, 1);
    if (ratio > 1) risk += 25;
    else if (ratio > 0.7) risk += 10;
  }

  return clamp(Math.round(risk), 0, 100);
};
