/** Shared badge-class helpers for room status, housekeeping status, guest VIP & loyalty. */

export function vipStatusClass(status: string | null | undefined): string {
	if (!status || status === "NONE") return "";
	if (status === "VVIP") return "badge-danger";
	return "badge-warning";
}

export function loyaltyTierClass(tier: string | null | undefined): string {
	switch (tier?.toUpperCase()) {
		case "ELITE":
			return "badge-danger";
		case "PLATINUM":
			return "badge-accent";
		case "GOLD":
			return "badge-warning";
		case "SILVER":
			return "badge-muted";
		case "BASE":
			return "badge-muted";
		default:
			return "";
	}
}

export function roomStatusClass(status: string): string {
	switch (status) {
		case "setup":
			return "badge-muted";
		case "available":
			return "badge-success";
		case "occupied":
			return "badge-accent";
		case "out_of_order":
		case "out_of_service":
			return "badge-danger";
		case "blocked":
			return "badge-warning";
		default:
			return "";
	}
}

export function housekeepingStatusClass(status: string): string {
	switch (status.toUpperCase()) {
		case "CLEAN":
		case "INSPECTED":
			return "badge-success";
		case "DIRTY":
			return "badge-danger";
		case "IN_PROGRESS":
			return "badge-warning";
		case "DO_NOT_DISTURB":
			return "badge-muted";
		default:
			return "";
	}
}

export function reservationStatusClass(status: string): string {
	switch (status?.toUpperCase()) {
		case "CONFIRMED":
			return "badge-success";
		case "CHECKED_IN":
			return "badge-accent";
		case "CHECKED_OUT":
			return "badge-muted";
		case "PENDING":
		case "INQUIRY":
		case "QUOTED":
		case "WAITLISTED":
			return "badge-warning";
		case "CANCELLED":
		case "NO_SHOW":
		case "EXPIRED":
			return "badge-danger";
		default:
			return "";
	}
}

export function groupBlockStatusClass(status: string): string {
	switch (status?.toUpperCase()) {
		case "DEFINITE":
		case "CONFIRMED":
			return "badge-success";
		case "TENTATIVE":
		case "PROSPECT":
			return "badge-accent";
		case "INQUIRY":
			return "badge-warning";
		case "CANCELLED":
		case "TURNDOWN":
			return "badge-danger";
		case "COMPLETED":
			return "badge-muted";
		default:
			return "";
	}
}
