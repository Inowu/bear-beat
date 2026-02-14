export type DunningStageDays = 0 | 1 | 3 | 7 | 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export const computeDunningStageDays = (failedAt: Date, now: Date): DunningStageDays | null => {
  const diffMs = now.getTime() - failedAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;

  const days = Math.floor(diffMs / DAY_MS);
  if (days >= 14) return 14;
  if (days >= 7) return 7;
  if (days >= 3) return 3;
  if (days >= 1) return 1;
  return 0;
};

