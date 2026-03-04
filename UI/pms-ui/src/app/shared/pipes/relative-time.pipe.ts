import { Pipe, type PipeTransform } from "@angular/core";

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

@Pipe({ name: "relativeTime", standalone: true })
export class RelativeTimePipe implements PipeTransform {
	transform(value: string | Date | null | undefined): string {
		if (!value) return "";

		const date = typeof value === "string" ? new Date(value) : value;
		const now = Date.now();
		const diffSeconds = Math.floor((now - date.getTime()) / 1000);

		if (diffSeconds < 0) return "just now";
		if (diffSeconds < MINUTE) return "just now";
		if (diffSeconds < HOUR) {
			const m = Math.floor(diffSeconds / MINUTE);
			return `${m}m ago`;
		}
		if (diffSeconds < DAY) {
			const h = Math.floor(diffSeconds / HOUR);
			return `${h}h ago`;
		}
		if (diffSeconds < DAY * 7) {
			const d = Math.floor(diffSeconds / DAY);
			return `${d}d ago`;
		}

		return date.toLocaleDateString();
	}
}
