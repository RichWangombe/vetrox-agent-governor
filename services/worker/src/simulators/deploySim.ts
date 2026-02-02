export const simulateRepo = (testsPassing = true) => {
  return {
    testsPassing,
    diffStat: {
      filesChanged: testsPassing ? 5 : 42,
      insertions: testsPassing ? 120 : 680,
      deletions: testsPassing ? 40 : 210
    }
  };
};
