/**
 * Wilson score lower bound of a Bernoulli parameter at the given confidence.
 * Reference: Edwin B. Wilson (1927). z=1.96 corresponds to 95% one-sided.
 *
 * Returns 0 for zero votes (so a brand-new review sorts below any voted review).
 */
export function wilsonLowerBound(up: number, down: number, z = 1.96): number {
  const n = up + down;
  if (n === 0) return 0;
  const phat = up / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const lower = (centre - margin) / denom;
  if (lower < 0) return 0;
  if (lower > 1) return 1;
  return lower;
}

/**
 * Convenience alias used by callers that pass an `(up, down)` tuple.
 * Same numeric result as {@link wilsonLowerBound}.
 */
export const wilsonScore = wilsonLowerBound;
