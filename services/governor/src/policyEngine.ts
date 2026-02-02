import type { ActionProposal } from "@agent-governor/shared";
import type { Policy, PolicyEvaluation, PolicyHit } from "@agent-governor/shared";

const deny = (hits: PolicyHit[], ruleId: string, message: string) => {
  hits.push({ ruleId, message, severity: "DENY" });
};

const confirm = (hits: PolicyHit[], ruleId: string, message: string) => {
  hits.push({ ruleId, message, severity: "CONFIRM" });
};

export const evaluatePolicy = (
  proposal: ActionProposal,
  policy: Policy,
  dailySpendUSDC = 0
): PolicyEvaluation => {
  const hits: PolicyHit[] = [];

  if (proposal.actionType === "TRANSFER") {
    const amount = Number(proposal.params.amountUSDC ?? proposal.params.amount ?? 0);
    const recipient = String(proposal.params.to ?? "");

    if (amount > policy.maxSingleTransferUSDC) {
      deny(
        hits,
        "maxSingleTransferUSDC",
        `Transfer amount ${amount} exceeds max single transfer ${policy.maxSingleTransferUSDC}.`
      );
    }

    if (dailySpendUSDC + amount > policy.maxDailySpendUSDC) {
      confirm(
        hits,
        "maxDailySpendUSDC",
        `Daily spend ${dailySpendUSDC + amount} exceeds max daily spend ${policy.maxDailySpendUSDC}.`
      );
    }

    if (policy.denylistRecipients.includes(recipient)) {
      deny(
        hits,
        "denylistRecipients",
        `Recipient ${recipient} is on the denylist.`
      );
    }

    if (
      policy.allowlistRecipients.length > 0 &&
      !policy.allowlistRecipients.includes(recipient)
    ) {
      confirm(
        hits,
        "allowlistRecipients",
        `Recipient ${recipient} is not on the allowlist.`
      );
    }
  }

  if (proposal.actionType === "SWAP") {
    const slippageBps = Number(proposal.params.slippageBps ?? 0);
    const liquidity = Number(proposal.context.market?.liquidityUSDC ?? 0);

    if (slippageBps > policy.swapMaxSlippageBps) {
      confirm(
        hits,
        "swapMaxSlippageBps",
        `Slippage ${slippageBps} bps exceeds max ${policy.swapMaxSlippageBps} bps.`
      );
    }

    if (liquidity < policy.swapMinLiquidityUSDC) {
      deny(
        hits,
        "swapMinLiquidityUSDC",
        `Liquidity ${liquidity} below min ${policy.swapMinLiquidityUSDC}.`
      );
    }
  }

  if (proposal.actionType === "DEPLOY_SIM") {
    const testsPassing = Boolean(proposal.context.repo?.testsPassing ?? true);
    if (policy.deployRequiresTestsPassing && !testsPassing) {
      deny(
        hits,
        "deployRequiresTestsPassing",
        "Tests are not passing for deploy simulation."
      );
    }
  }

  if (proposal.actionType === "API_CALL") {
    const containsPII = Boolean(proposal.context.api?.containsPII ?? false);
    if (policy.apiDenyPIIExfiltration && containsPII) {
      deny(
        hits,
        "apiDenyPIIExfiltration",
        "API call contains PII and policy forbids exfiltration."
      );
    }
  }

  return { hits, dailySpendUSDC };
};
