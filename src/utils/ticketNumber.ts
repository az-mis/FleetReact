/**
 * Generates a unique Trip Ticket Number for approved vehicle requests.
 * Format: FMS-YYYY-MM-XXXX
 * Example: FMS-2026-09-K8W2
 * 
 * - YYYY: 4-digit year of approval
 * - MM: 2-digit month of approval (01-12)
 * - XXXX: 4 random alphanumeric characters (avoiding confusing chars like 0/O, 1/I/L)
 *   to ensure uniqueness even if multiple admins approve requests concurrently.
 */
const TICKET_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTripTicketNumber(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  
  let randomSuffix = "";
  for (let i = 0; i < 4; i++) {
    randomSuffix += TICKET_ALPHABET[Math.floor(Math.random() * TICKET_ALPHABET.length)];
  }

  return `FMS-${year}-${month}-${randomSuffix}`;
}
