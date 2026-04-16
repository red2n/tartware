import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnDestroy, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute } from "@angular/router";
import type {
	BatchUpdateCommandFeaturesResponse,
	CommandFeatureListItem,
	CommandFeatureStatus,
} from "@tartware/schemas";
import { type Subscription } from "rxjs";

import { ApiService } from "../../core/api/api.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";

type ServiceTab = "all" | string;

@Component({
	selector: "app-command-management",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatSlideToggleModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./command-management.html",
	styleUrl: "./command-management.scss",
})
export class CommandManagementComponent implements OnInit, OnDestroy {
	private readonly api = inject(ApiService);
	private readonly route = inject(ActivatedRoute);
	readonly globalSearch = inject(GlobalSearchService);
	private paramSub?: Subscription;

	/** Server state — the last-known saved statuses. */
	private serverStatuses = new Map<string, CommandFeatureStatus>();

	readonly commands = signal<CommandFeatureListItem[]>([]);
	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeTab = signal<ServiceTab>("all");

	/** Local overrides not yet saved. Maps command_name → desired status. */
	readonly pendingChanges = signal<Map<string, CommandFeatureStatus>>(new Map());

	readonly hasChanges = computed(() => this.pendingChanges().size > 0);
	readonly pendingCount = computed(() => this.pendingChanges().size);

	/** Filtered commands based on active tab and search query. */
	readonly filteredCommands = computed(() => {
		const tab = this.activeTab();
		const query = this.globalSearch.query().toLowerCase().trim();
		let items = this.commands();

		if (tab !== "all") {
			items = items.filter((c) => c.default_target_service === tab);
		}

		if (query) {
			items = items.filter(
				(c) =>
					c.command_name.toLowerCase().includes(query) ||
					c.label.toLowerCase().includes(query) ||
					c.description.toLowerCase().includes(query) ||
					c.default_target_service.toLowerCase().includes(query),
			);
		}

		return items;
	});

	readonly enabledCount = computed(
		() => this.commands().filter((c) => this.getEffectiveStatus(c) === "enabled").length,
	);
	readonly totalCount = computed(() => this.commands().length);

	ngOnInit(): void {
		this.loadCommands();
		this.paramSub = this.route.params.subscribe((params) => {
			const tab = (params["serviceTab"] as string) ?? "all";
			this.activeTab.set(tab);
		});
	}

	ngOnDestroy(): void {
		this.paramSub?.unsubscribe();
	}

	/** Get the effective status (pending override or server state). */
	getEffectiveStatus(command: CommandFeatureListItem): CommandFeatureStatus {
		return this.pendingChanges().get(command.command_name) ?? command.status;
	}

	/** Check if a command has been modified from its saved state. */
	isModified(commandName: string): boolean {
		return this.pendingChanges().has(commandName);
	}

	async loadCommands(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);
		try {
			const data = await this.api.get<CommandFeatureListItem[]>("/commands/features");
			this.commands.set(data);
			this.serverStatuses = new Map(data.map((c) => [c.command_name, c.status]));
			this.pendingChanges.set(new Map());
		} catch (err) {
			this.error.set(err instanceof Error ? err.message : "Failed to load commands");
		} finally {
			this.loading.set(false);
		}
	}

	/** Toggle locally — no API call, just track the change. */
	toggleStatus(command: CommandFeatureListItem): void {
		const current = this.getEffectiveStatus(command);
		const newStatus: CommandFeatureStatus = current === "enabled" ? "disabled" : "enabled";
		const serverStatus = this.serverStatuses.get(command.command_name);

		this.pendingChanges.update((map) => {
			const next = new Map(map);
			if (newStatus === serverStatus) {
				next.delete(command.command_name);
			} else {
				next.set(command.command_name, newStatus);
			}
			return next;
		});
	}

	/** Discard all unsaved changes. */
	discardChanges(): void {
		this.pendingChanges.set(new Map());
	}

	/** Send all pending changes to the server in one batch request. */
	async saveChanges(): Promise<void> {
		const changes = this.pendingChanges();
		if (changes.size === 0) return;

		this.saving.set(true);
		this.error.set(null);

		const updates = Array.from(changes.entries()).map(([command_name, status]) => ({
			command_name,
			status,
		}));

		try {
			const result = await this.api.patch<BatchUpdateCommandFeaturesResponse>(
				"/commands/features/batch",
				{ updates },
			);

			// Apply successful updates to local state
			const updatedNames = new Set(result.updated.map((u) => u.command_name));
			this.commands.update((cmds) =>
				cmds.map((c) => {
					const newStatus = changes.get(c.command_name);
					if (newStatus && updatedNames.has(c.command_name)) {
						return { ...c, status: newStatus };
					}
					return c;
				}),
			);

			// Update server state tracking
			for (const u of result.updated) {
				this.serverStatuses.set(u.command_name, u.status);
			}

			// Clear only successfully saved changes
			this.pendingChanges.update((map) => {
				const next = new Map(map);
				for (const name of updatedNames) {
					next.delete(name);
				}
				return next;
			});

			if (result.failed.length > 0) {
				this.error.set(
					`${result.failed.length} command(s) failed to update: ${result.failed.map((f) => f.command_name).join(", ")}`,
				);
			}
		} catch (err) {
			this.error.set(err instanceof Error ? err.message : "Failed to save changes");
		} finally {
			this.saving.set(false);
		}
	}

	statusBadgeClass(status: CommandFeatureStatus): string {
		switch (status) {
			case "enabled":
				return "badge-success";
			case "disabled":
				return "badge-danger";
			case "observation":
				return "badge-warning";
		}
	}

	formatServiceName(service: string): string {
		return service
			.replace(/-service$/, "")
			.replace(/-/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}
}
