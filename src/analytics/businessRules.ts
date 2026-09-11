export const ANALYTICS_RULES = {
  historyWeeks: 8,
  minimumComparableOccurrences: 4,
  removalOccurrences: 8,
  removalWeeks: 8,
  targetCompleteness: 0.8,
  highWasteRate: 0.3,
  lowSalesRate: 0.5,
  balancedSalesRate: 0.75,
  strongSalesRate: 0.95,
  lowWasteRate: 0.05,
  controlledWasteRate: 0.15,
  stockoutOccurrences: 3,
  stockoutRate: 0.5,
  initialBuffer: 0.25,
  minimumBuffer: 0.1,
  bufferStep: 0.05,
  maxIncrease: 0.3,
  maxDecrease: 0.25,
  minimumVariety: 4,
  minimumBox: 2,
} as const;

export const normalizeBuffer = (value: number): number => {
  const bounded = Math.max(ANALYTICS_RULES.minimumBuffer, value);
  const steps = Math.round((bounded - ANALYTICS_RULES.minimumBuffer) / ANALYTICS_RULES.bufferStep);
  return Number((ANALYTICS_RULES.minimumBuffer + steps * ANALYTICS_RULES.bufferStep).toFixed(2));
};
