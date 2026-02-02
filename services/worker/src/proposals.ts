import { randomUUID } from "crypto";
import type { ActionProposal } from "@agent-governor/shared";
import { simulateMarket } from "./simulators/dexSimulator.js";
import { simulateWallet } from "./simulators/walletSimulator.js";
import { simulateRepo } from "./simulators/deploySim.js";
import { simulateApiContext } from "./simulators/apiSim.js";

const agentId = "worker-agent-1";
const allowlist = ["0xSAFE_ALLOWLIST_1", "0xSAFE_ALLOWLIST_2"];

const buildProposal = (partial: Omit<ActionProposal, "id" | "timestamp" | "agentId">) => {
  return {
    ...partial,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    agentId
  };
};

export const safeTransferProposal = (): ActionProposal =>
  buildProposal({
    actionType: "TRANSFER",
    intent: "Transfer small amount to allowlisted recipient.",
    params: { amountUSDC: 10, to: allowlist[0] },
    context: { wallet: simulateWallet(200) }
  });

export const riskyTransferProposal = (): ActionProposal =>
  buildProposal({
    actionType: "TRANSFER",
    intent: "Transfer large amount to unknown recipient.",
    params: { amountUSDC: 120, to: "0xUNKNOWN" },
    context: { wallet: simulateWallet(200) }
  });

export const safeSwapProposal = (): ActionProposal =>
  buildProposal({
    actionType: "SWAP",
    intent: "Swap with low slippage and high liquidity.",
    params: { slippageBps: 20, amountUSDC: 50, pair: "USDC/ETH" },
    context: { market: simulateMarket({ volatility: 0.2, liquidityUSDC: 12000 }) }
  });

export const riskySwapProposal = (): ActionProposal =>
  buildProposal({
    actionType: "SWAP",
    intent: "Swap with high slippage in low liquidity.",
    params: { slippageBps: 220, amountUSDC: 50, pair: "USDC/ETH" },
    context: { market: simulateMarket({ volatility: 0.9, liquidityUSDC: 800 }) }
  });

export const safeDeployProposal = (): ActionProposal =>
  buildProposal({
    actionType: "DEPLOY_SIM",
    intent: "Deploy with passing tests.",
    params: { branch: "main" },
    context: { repo: simulateRepo(true) }
  });

export const riskyDeployProposal = (): ActionProposal =>
  buildProposal({
    actionType: "DEPLOY_SIM",
    intent: "Deploy with failing tests.",
    params: { branch: "feature/quick-fix" },
    context: { repo: simulateRepo(false) }
  });

export const safeApiCallProposal = (): ActionProposal =>
  buildProposal({
    actionType: "API_CALL",
    intent: "Send non-sensitive analytics payload.",
    params: { endpoint: "/analytics", payloadSize: 5 },
    context: { api: simulateApiContext(false) }
  });

export const riskyApiCallProposal = (): ActionProposal =>
  buildProposal({
    actionType: "API_CALL",
    intent: "Send PII payload to external endpoint.",
    params: { endpoint: "/external/export", payloadSize: 50 },
    context: { api: simulateApiContext(true) }
  });

export const generateProposalSequence = (): ActionProposal[] => [
  safeTransferProposal(),
  riskyTransferProposal(),
  safeSwapProposal(),
  riskySwapProposal(),
  safeDeployProposal(),
  riskyDeployProposal(),
  safeApiCallProposal(),
  riskyApiCallProposal()
];

export const proposalFactories = [
  safeTransferProposal,
  riskyTransferProposal,
  safeSwapProposal,
  riskySwapProposal,
  safeDeployProposal,
  riskyDeployProposal,
  safeApiCallProposal,
  riskyApiCallProposal
];
