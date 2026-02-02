export const simulateMarket = (overrides: Partial<Record<string, number>> = {}) => {
  return {
    volatility: overrides.volatility ?? Number((Math.random() * 0.9).toFixed(2)),
    liquidityUSDC: overrides.liquidityUSDC ?? Math.round(3000 + Math.random() * 9000),
    spreadBps: overrides.spreadBps ?? Math.round(10 + Math.random() * 40)
  };
};
