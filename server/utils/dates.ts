// "Today" for date checks on the server. The server runs in UTC but the team is ahead of it (Manila is UTC+8), so in
// the morning their today is UTC's tomorrow. Checks like "can't be in the future" use the latest calendar date anywhere
// (UTC+14): a person's own today is never refused, and a real future date still is.

/** YYYY-MM-DD: the latest date it is anywhere right now. */
export function latestToday(): string {
  return new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10)
}

/** YYYY-MM-01 of latestToday(). */
export function latestMonth(): string {
  return `${latestToday().slice(0, 7)}-01`
}
