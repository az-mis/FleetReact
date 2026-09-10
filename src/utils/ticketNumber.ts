/**
 * Trip Ticket Number generator
 * Format: FMS-{LOC}-{YYYY}-{MM}-{NNNN}
 * Example: FMS-QC-2026-09-0001
 *
 * - LOC:  2–3 letter abbreviation derived from the request location
 * - YYYY: 4-digit year of approval
 * - MM:   2-digit month of approval (01–12)
 * - NNNN: Sequential 4-digit counter (0001…9999) — number of approved
 *         trip tickets already issued for that location+month, plus one.
 */

/** Maps the LOCATIONS strings (from RequestVehicle.tsx) to short codes. */
export const LOCATION_CODE: Record<string, string> = {
  "Oriental Mindoro": "ORM",
  "Occidental Mindoro": "OCM",
  "Marinduque": "MAR",
  "Palawan": "PLW",
  "Romblon": "ROM",
  "Quezon City Satellite Office": "QC",
};

/** Returns the 2–3 char location code, or "FMS" as a generic fallback. */
export function getLocationCode(location?: string | null): string {
  if (!location) return "FMS";
  return LOCATION_CODE[location] ?? location.slice(0, 3).toUpperCase();
}

/**
 * Builds the trip ticket number given the location code, year, month,
 * and the next sequential counter for that location+month.
 */
export function buildTripTicketNumber(
  locationCode: string,
  date: Date,
  sequence: number
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `FMS-${locationCode}-${year}-${month}-${seq}`;
}
