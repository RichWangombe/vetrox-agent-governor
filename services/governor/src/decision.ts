import type {
  ActionProposal,
  GovernorDecision,
  GeminiRecommendation,
  Policy,
  PolicyEvaluation
} from "@agent-governor/shared";

const policyOverride = (evaluation: PolicyEvaluation) => {
  const denyHits = evaluation.hits.filter((hit) => hit.severity === "DENY");
  const confirmHits = evaluation.hits.filter((hit) => hit.severity === "CONFIRM");
  if (denyHits.length > 0) return { decision: "DENY", hits: denyHits };
  if (confirmHits.length > 0) return { decision: "REQUIRE_CONFIRMATION", hits: confirmHits };
  return null;
};

const deriveRequiredEdits = (evaluation: PolicyEvaluation): string[] => {
  const edits: string[] = [];
  for (const hit of evaluation.hits) {
    switch (hit.ruleId) {
      case "maxSingleTransferUSDC":
        edits.push("Reduce transfer amount below the policy max.");
        break;
      case "maxDailySpendUSDC":
        edits.push("Wait for the daily spend window to reset or lower amount.");
        break;
      case "allowlistRecipients":
        edits.push("Use an allowlisted recipient or update allowlist.");
        break;
      case "denylistRecipients":
        edits.push("Choose a recipient not on the denylist.");
        break;
      case "swapMaxSlippageBps":
        edits.push("Lower slippage tolerance.");
        break;
      case "swapMinLiquidityUSDC":
        edits.push("Select a pool with higher liquidity.");
        break;
      case "deployRequiresTestsPassing":
        edits.push("Run and pass tests before deployment.");
        break;
      case "apiDenyPIIExfiltration":
        edits.push("Redact or tokenize PII before API calls.");
        break;
      default:
        edits.push(hit.message);
    }
  }
  return edits;
};

const deriveSafeAlternative = (proposal: ActionProposal, policy: Policy): string | undefined => {
  if (proposal.actionType === "TRANSFER") {
    const safeAmount = Math.min(policy.maxSingleTransferUSDC, policy.maxDailySpendUSDC);
    const allowlisted = policy.allowlistRecipients[0] ?? "allowlisted_recipient";
    return `Propose a transfer of ${safeAmount} USDC to ${allowlisted}.`;
  }
  if (proposal.actionType === "SWAP") {
    return `Use slippage <= ${policy.swapMaxSlippageBps} bps and liquidity >= ${policy.swapMinLiquidityUSDC} USDC.`;
  }
  if (proposal.actionType === "DEPLOY_SIM") {
    return "Re-run tests and re-propose after they pass.";
  }
  if (proposal.actionType === "API_CALL") {
    return "Send a redacted payload with no PII.";
  }
  return undefined;
};

export const composeDecision = (
  proposal: ActionProposal,
  policy: Policy,
  evaluation: PolicyEvaluation,
  recommendation: GeminiRecommendation,
  riskScore: number
): GovernorDecision => {
  const override = policyOverride(evaluation);
  const finalDecision = override?.decision ?? recommendation.decision;
  const policyHits = evaluation.hits.map((hit) => hit.ruleId);
  const requiredEdits = evaluation.hits.length > 0 ? deriveRequiredEdits(evaluation) : undefined;
  const safeAlternative =
    finalDecision !== "APPROVE" ? deriveSafeAlternative(proposal, policy) : undefined;

  const explanation = override
    ? `Policy override (${override.hits.map((hit) => hit.ruleId).join(", ")}). ${recommendation.explanation}`
    : recommendation.explanation;

  return {
    proposalId: proposal.id,
    decision: finalDecision,
    riskScore,
    policyHits,
    explanation,
    requiredEdits,
    safeAlternative
  };
};
