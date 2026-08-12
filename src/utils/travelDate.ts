// Shared helpers for VehicleRequest.travelDate / travelDateEnd, which
// together represent a single-day trip (travelDateEnd unset) or a multi-day
// trip (travelDateEnd set, always >= travelDate).

/** Human-readable "Aug 24, 2026" or "Aug 24 – 26, 2026" / "Aug 30 – Sep 2, 2026". */
export function formatTravelDateRange(travelDate?: string | null, travelDateEnd?: string | null): string {
  if (!travelDate) return "—";
  const start = parseDateOnly(travelDate);
  if (!start) return travelDate;
  if (!travelDateEnd || travelDateEnd === travelDate) {
    return start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  const end = parseDateOnly(travelDateEnd);
  if (!end) return start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = sameMonth
    ? end.toLocaleDateString(undefined, { day: "numeric" })
    : end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

/** True if [aStart, aEnd] and [bStart, bEnd] overlap by at least one day. */
export function dateRangesOverlap(
  aStart: string,
  aEnd: string | null | undefined,
  bStart: string,
  bEnd: string | null | undefined
): boolean {
  const aFrom = aStart;
  const aTo = aEnd || aStart;
  const bFrom = bStart;
  const bTo = bEnd || bStart;
  return aFrom <= bTo && bFrom <= aTo;
}

function parseDateOnly(value: string): Date | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
