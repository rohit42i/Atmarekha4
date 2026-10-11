/**
 * Pure engagement calculations are kept separate from storage and network IO.
 */

/**
 * @param {Array<{ rating?: unknown }> | null | undefined} rows
 * @returns {{ average: number, count: number }}
 */
export function buildRatingSummary(rows = []) {
  const ratings = (Array.isArray(rows) ? rows : [])
    .map((row) => Number(row?.rating))
    .filter(Number.isFinite);

  return {
    average: ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : 0,
    count: ratings.length,
  };
}
