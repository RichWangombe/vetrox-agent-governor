import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  type ActionProposal,
  type GeminiRecommendation,
  type Policy
} from "@agent-governor/shared";
import { scoreRisk } from "@agent-governor/shared";

export interface GeminiJudgeResult {
  recommendation: GeminiRecommendation;
  raw?: string;
  usedMock: boolean;
}

const getModelName = () => process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

const normalizeDecision = (value: string): GeminiRecommendation["decision"] => {
  const upper = value.toUpperCase();
  if (upper === "APPROVE" || upper === "DENY" || upper === "REQUIRE_CONFIRMATION") {
    return upper;
  }
  return "REQUIRE_CONFIRMATION";
};

const parseRecommendation = (text: string): GeminiRecommendation | null => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== "object") return null;
    const decision = normalizeDecision(String(parsed.decision ?? ""));
    const riskFactors = Array.isArray(parsed.riskFactors)
      ? parsed.riskFactors.map((item: unknown) => String(item))
      : [];
    const explanation = String(parsed.explanation ?? "");
    if (!explanation) return null;
    return { decision, riskFactors, explanation };
  } catch {
    return null;
  }
};

const mockJudge = (proposal: ActionProposal, policy: Policy): GeminiRecommendation => {
  const riskScore = scoreRisk(proposal, policy, {});
  const decision =
    riskScore >= 80 ? "DENY" : riskScore >= 55 ? "REQUIRE_CONFIRMATION" : "APPROVE";
  const riskFactors = [`Mock risk score ${riskScore}`, `Action: ${proposal.actionType}`];
  const explanation =
    "Mock judge used (missing API key). Decision based on deterministic risk scoring.";
  return { decision, riskFactors, explanation };
};

export const judgeWithGemini = async (
  proposal: ActionProposal,
  policy: Policy,
  auditSummary: Record<string, unknown>
): Promise<GeminiJudgeResult> => {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey || process.env.GEMINI_MOCK === "true") {
    return { recommendation: mockJudge(proposal, policy), usedMock: true };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: getModelName() });
    const prompt = [
      "You are a risk analyst for autonomous agents.",
      "Given an action proposal, current policy, and recent audit summary,",
      "return a JSON object with keys: decision (APPROVE|DENY|REQUIRE_CONFIRMATION),",
      "riskFactors (array of short strings), and explanation (plain English).",
      "Return ONLY valid JSON.",
      "",
      "ACTION_PROPOSAL:",
      JSON.stringify(proposal),
      "",
      "POLICY:",
      JSON.stringify(policy),
      "",
      "AUDIT_SUMMARY:",
      JSON.stringify(auditSummary)
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseRecommendation(text);
    if (!parsed) {
      return { recommendation: mockJudge(proposal, policy), raw: text, usedMock: true };
    }
    return { recommendation: parsed, raw: text, usedMock: false };
  } catch (error) {
    return {
      recommendation: mockJudge(proposal, policy),
      raw: error instanceof Error ? error.message : String(error),
      usedMock: true
    };
  }
};
