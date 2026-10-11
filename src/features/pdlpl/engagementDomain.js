/**
 * Convert the pre-aggregated PdPL summary row into the public view model.
 * This is intentionally a pure mapping: permissions remain the responsibility
 * of the database policies and the service that fetches the row.
 *
 * @param {Record<string, unknown> | null | undefined} row
 */
export function normalizePdlplPublicSummary(row) {
  const ratings = Number(row?.ratings_count) || 0;
  const ratingsSum = Number(row?.ratings_sum) || 0;
  return {
    rating: {
      average: ratings > 0 ? ratingsSum / ratings : 0,
      count: ratings,
    },
    views: Number(row?.views_count) || 0,
    likes: Number(row?.likes_count) || 0,
    comments: Number(row?.comments_count) || 0,
    pages: Number(row?.pages_count) || 0,
    shares: Number(row?.shares_count) || 0,
  };
}
