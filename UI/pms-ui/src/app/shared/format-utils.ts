/**
 * Shared date formatting utilities.
 *
 * Currency and time-of-day formatting live on `SettingsService` instead, which
 * resolves the property's locale and currency; a second hardcoded en-US/USD
 * implementation here would silently disagree with it.
 */

/**
 * Format a date as a relative time (e.g. "3h ago", "tomorrow", "Apr 14").
 *
 * Handles both directions — past events read "3h ago", future ones "in 3h" —
 * so activity feeds and due-date lists can share one formatter. Beyond a week
 * it falls back to an absolute date, since "12d ago" stops being useful.
 */
export function relativeTime(date: Date | string): string {
	const d = new Date(date);
	const diffMs = d.getTime() - Date.now();
	const diffMins = Math.floor(Math.abs(diffMs) / 60_000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);
	const past = diffMs < 0;

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return past ? `${diffMins}m ago` : `in ${diffMins}m`;
	if (diffHours < 24) return past ? `${diffHours}h ago` : `in ${diffHours}h`;
	if (diffDays === 1) return past ? "yesterday" : "tomorrow";
	if (diffDays < 7) return past ? `${diffDays}d ago` : `in ${diffDays}d`;
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
