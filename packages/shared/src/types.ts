export type ActionType = "TRANSFER" | "SWAP" | "DEPLOY_SIM" | "API_CALL";

export interface MarketContext {
  volatility?: number;
  liquidityUSDC?: number;
  spreadBps?: number;
  [key: string]: unknown;
}

export interface WalletContext {
  balanceUSDC?: number;
  recipientRiskScore?: number;
  [key: string]: unknown;
}

export interface RepoContext {
  testsPassing?: boolean;
  diffStat?: {
    filesChanged?: number;
    insertions?: number;
    deletions?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ApiContext {
  containsPII?: boolean;
  sensitivity?: string;
  [key: string]: unknown;
}

export interface ActionProposal {
  id: string;
  timestamp: string;
  agentId: string;
  actionType: ActionType;
  intent: string;
  params: Record<string, unknown>;
  context: {
    market?: MarketContext;
    wallet?: WalletContext;
    repo?: RepoContext;
    api?: ApiContext;
  };
}

export type Decision = "APPROVE" | "DENY" | "REQUIRE_CONFIRMATION";

export interface GovernorDecision {
  proposalId: string;
  decision: Decision;
  riskScore: number;
  policyHits: string[];
  explanation: string;
  requiredEdits?: string[];
  safeAlternative?: string;
}

export interface GeminiRecommendation {
  decision: Decision;
  riskFactors: string[];
  explanation: string;
}

export interface AuditEntry {
  id: number;
  proposalId: string;
  createdAt: string;
  decision: Decision;
  proposal: ActionProposal;
  decisionPayload: GovernorDecision;
  latencyMs: number;
  geminiRaw?: string;
}
