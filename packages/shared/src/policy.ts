export interface Policy {
  maxDailySpendUSDC: number;
  maxSingleTransferUSDC: number;
  allowlistRecipients: string[];
  denylistRecipients: string[];
  swapMaxSlippageBps: number;
  swapMinLiquidityUSDC: number;
  deployRequiresTestsPassing: boolean;
  apiDenyPIIExfiltration: boolean;
}

export type PolicySeverity = "DENY" | "CONFIRM";

export interface PolicyHit {
  ruleId: string;
  message: string;
  severity: PolicySeverity;
}

export interface PolicyEvaluation {
  hits: PolicyHit[];
  dailySpendUSDC: number;
}

export const DEFAULT_POLICY: Policy = {
  maxDailySpendUSDC: 50,
  maxSingleTransferUSDC: 25,
  allowlistRecipients: ["0xSAFE_ALLOWLIST_1", "0xSAFE_ALLOWLIST_2"],
  denylistRecipients: ["0xDENY_1", "0xDENY_2"],
  swapMaxSlippageBps: 50,
  swapMinLiquidityUSDC: 5000,
  deployRequiresTestsPassing: true,
  apiDenyPIIExfiltration: true
};
