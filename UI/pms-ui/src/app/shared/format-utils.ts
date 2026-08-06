/** Shared formatting utilities for dates and currencies. */

/** Format a number as currency (e.g. "$1,234.56"). */
export function formatCurrency(
	amount: number,
	currency: string,
	fractionDigits?: { min: number; max: number },
): string {
	const opts: Intl.NumberFormatOptions = {
		style: "currency",
		currency: currency || "USD",
	};
	if (fractionDigits) {
		opts.minimumFractionDigits = fractionDigits.min;
		opts.maximumFractionDigits = fractionDigits.max;
	}
	return new Intl.NumberFormat("en-US", opts).format(amount);
}

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

/** Format a date/string as a short time (e.g. "2:30 PM"). */
export function formatTime(dateStr: string | Date): string {
	const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
	return d.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});
}
