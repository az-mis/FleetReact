interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Checks if an action is allowed under the sliding window rate limit.
 * @param actionKey Unique identifier for the rate limited action
 * @param maxAttempts Maximum allowed attempts in the window
 * @param windowMs Time window in milliseconds
 * @returns { allowed: boolean, waitTimeSeconds: number, remainingAttempts: number }
 */
export function checkRateLimit(
  actionKey: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; waitTimeSeconds: number; remainingAttempts: number } {
  try {
    const storageKey = `rate_limit_${actionKey}`;
    const raw = localStorage.getItem(storageKey);
    const now = Date.now();
    let timestamps: number[] = [];

    if (raw) {
      const parsed: RateLimitRecord = JSON.parse(raw);
      // Retain only timestamps within the active sliding window
      timestamps = (parsed.timestamps || []).filter((t) => now - t < windowMs);
    }

    if (timestamps.length >= maxAttempts) {
      const oldestValid = timestamps[0];
      const waitTimeMs = Math.max(0, windowMs - (now - oldestValid));
      return {
        allowed: false,
        waitTimeSeconds: Math.ceil(waitTimeMs / 1000),
        remainingAttempts: 0,
      };
    }

    return {
      allowed: true,
      waitTimeSeconds: 0,
      remainingAttempts: maxAttempts - timestamps.length,
    };
  } catch {
    // If localStorage is unavailable, allow the action by default
    return { allowed: true, waitTimeSeconds: 0, remainingAttempts: maxAttempts };
  }
}

/**
 * Records an attempt for the specified actionKey.
 */
export function recordAttempt(actionKey: string, windowMs: number): void {
  try {
    const storageKey = `rate_limit_${actionKey}`;
    const raw = localStorage.getItem(storageKey);
    const now = Date.now();
    let timestamps: number[] = [];

    if (raw) {
      const parsed: RateLimitRecord = JSON.parse(raw);
      timestamps = (parsed.timestamps || []).filter((t) => now - t < windowMs);
    }

    timestamps.push(now);
    localStorage.setItem(storageKey, JSON.stringify({ timestamps }));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Sanitizes input strings to prevent basic XSS and injection attacks.
 */
export function sanitizeInput(value: string, maxLength: number = 250): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/[<>]/g, "") // strip dangerous bracket characters
    .slice(0, maxLength);
}
