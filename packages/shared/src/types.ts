export type ActionType = "TRANSFER" | "SWAP" | "DEPLOY_SIM" | "API_CALL";

export interface ActionProposal {
  id: string;
  timestamp: string;
  agentId: string;
  actionType: ActionType;
  intent: string;
  params: Record<string, unknown>;
  context: {
    market?: Record<string, unknown>;
    wallet?: Record<string, unknown>;
    repo?: Record<string, unknown>;
    api?: Record<string, unknown>;
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
