export const simulateApiContext = (containsPII = false) => {
  return {
    containsPII,
    sensitivity: containsPII ? "high" : "low"
  };
};
