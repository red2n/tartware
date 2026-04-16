import { Injectable, inject, signal } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs";

@Injectable({ providedIn: "root" })
export class GlobalSearchService {
	private readonly router = inject(Router);
	readonly query = signal("");

	constructor() {
		this.router.events
			.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
			.subscribe(() => this.clear());
	}

	setQuery(value: string): void {
		this.query.set(value);
	}

	clear(): void {
		this.query.set("");
	}
}
