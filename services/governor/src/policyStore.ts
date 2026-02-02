import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { DEFAULT_POLICY, type Policy } from "@agent-governor/shared";

export const policySchema = z.object({
  maxDailySpendUSDC: z.number().nonnegative(),
  maxSingleTransferUSDC: z.number().nonnegative(),
  allowlistRecipients: z.array(z.string()),
  denylistRecipients: z.array(z.string()),
  swapMaxSlippageBps: z.number().nonnegative(),
  swapMinLiquidityUSDC: z.number().nonnegative(),
  deployRequiresTestsPassing: z.boolean(),
  apiDenyPIIExfiltration: z.boolean()
});

const policyPath = path.resolve(process.cwd(), "policy.json");

export const loadPolicy = async (): Promise<Policy> => {
  try {
    const raw = await fs.readFile(policyPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = policySchema.safeParse(parsed);
    if (!result.success) return DEFAULT_POLICY;
    return result.data;
  } catch {
    return DEFAULT_POLICY;
  }
};

export const savePolicy = async (policy: Policy): Promise<void> => {
  const result = policySchema.safeParse(policy);
  if (!result.success) throw new Error("Invalid policy payload");
  await fs.writeFile(policyPath, JSON.stringify(result.data, null, 2));
};

export const validatePolicy = (input: unknown): Policy => {
  return policySchema.parse(input);
};
