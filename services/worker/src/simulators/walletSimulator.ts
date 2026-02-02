export const simulateWallet = (balanceUSDC = 120) => {
  return {
    balanceUSDC,
    recipientRiskScore: Math.round(Math.random() * 100)
  };
};
