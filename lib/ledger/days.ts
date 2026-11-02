/** A date as YYYY-MM-DD in the given time zone (en-CA formats dates that way). */
export function dayIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * The last `n` calendar days in `timeZone`, oldest first, ending today. The
 * chart needs every day on its axis, including the ones with no usage, which
 * a GROUP BY never returns.
 */
export function lastDays(n: number, now: Date, timeZone: string): string[] {
  const today = dayIn(now, timeZone);
  // Step back from noon UTC on "today" so DST shifts can't skip or repeat a day.
  const anchor = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}
