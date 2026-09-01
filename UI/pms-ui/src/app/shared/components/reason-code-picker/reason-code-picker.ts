import { Component, computed, effect, inject, input, output, signal } from "@angular/core";

import {
	actorClearsApprovalLevel,
	approvalLevelMinRole,
	type ReasonCodeListItem,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";

/**
 * Pick the reason code a controlled command requires.
 *
 * **Why this exists.** Six commands now refuse without a code from a named
 * category — the blacklist override, the credit-limit override, the rate
 * override, the city-ledger write-off, the night audit's precondition bypass
 * and the room move. Not one screen could supply one: grepping `pms-ui` for a
 * reason-code picker returned nothing, so the whole override model was
 * reachable over the API only, and the rate-override button posted free text at
 * a command that had stopped accepting it.
 *
 * **What it shows that a plain dropdown would not.** Each code carries an
 * `approval_level`, and that level is enforced at apply time — a clerk who
 * names `BL_GM_CLEARED` gets a 202 and then a failed command, which is a poor
 * way to learn about a control. So the picker resolves the level against the
 * operator's own membership role and marks the codes they cannot use, using the
 * same `approvalLevelMinRole` translation the handler will use. It marks rather
 * than hides them: "you need an owner for this" is useful, and a code that
 * silently is not in the list looks like a code that does not exist.
 *
 * This is advisory. The authority check that matters runs in the consumer,
 * against the role on the command envelope, and this component cannot weaken
 * it — a caller who ignores the warning is refused there.
 *
 * ```html
 * <app-reason-code-picker
 *   category="RATE_OVERRIDE"
 *   [propertyId]="reservation()?.property_id ?? ''"
 *   [value]="form().reason_code"
 *   (valueChange)="form.set({ ...form(), reason_code: $event })" />
 * ```
 */
@Component({
	selector: "app-reason-code-picker",
	standalone: true,
	imports: [TranslatePipe],
	template: `
    <div class="form-group">
      <label class="field-label" [attr.for]="fieldId">{{ label() | translate }} *</label>

      @if (loading()) {
        <div class="skeleton skeleton-block" style="height: 2.25rem"></div>
      } @else if (loadFailed()) {
        <p class="field-hint field-hint-error">
          {{ 'Could not load reason codes. Retry, or the command will be refused without one.' | translate }}
        </p>
      } @else if (codes().length === 0) {
        <p class="field-hint field-hint-error">
          {{ 'No reason codes are configured for this action. Ask an administrator to add one.' | translate }}
        </p>
      } @else {
        <select
          class="field-input"
          [id]="fieldId"
          [value]="value()"
          (change)="onPick($event)">
          <option value="">{{ 'Select a reason…' | translate }}</option>
          @for (code of codes(); track code.reason_id) {
            <option [value]="code.reason_code">
              @if (clears(code)) {
                {{ code.reason_name }}
              } @else {
                {{ '{name} — needs {role}' | translate:{ name: code.reason_name, role: minRole(code) } }}
              }
            </option>
          }
        </select>

        @if (selected(); as picked) {
          @if (picked.reason_description) {
            <p class="field-hint">{{ picked.reason_description }}</p>
          }
          @if (!clears(picked)) {
            <p class="field-hint field-hint-error">
              {{ 'This reason needs {role}. Submitted under your role the command is accepted and then refused.' | translate:{ role: minRole(picked) } }}
            </p>
          }
        }
      }
    </div>
  `,
	styles: [":host { display: contents; }"],
})
export class ReasonCodePickerComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);

	/** The `reason_codes.reason_category` this command demands, e.g. `WRITE_OFF`. */
	readonly category = input.required<string>();
	/** Narrows to a property's own codes alongside the tenant-wide ones. */
	readonly propertyId = input<string>("");
	readonly label = input<string>("Reason");
	readonly value = input<string>("");
	readonly valueChange = output<string>();

	readonly codes = signal<ReasonCodeListItem[]>([]);
	readonly loading = signal(false);
	readonly loadFailed = signal(false);

	/** Stable enough for a label's `for`, and unique across two pickers on a screen. */
	readonly fieldId = `reason-code-${Math.random().toString(36).slice(2, 9)}`;

	readonly selected = computed(() =>
		this.codes().find((code) => code.reason_code === this.value()),
	);

	constructor() {
		// Refetch when the category or property changes: the same screen opens
		// this for more than one command.
		effect(() => {
			const category = this.category();
			const propertyId = this.propertyId();
			void this.load(category, propertyId);
		});
	}

	private async load(category: string, propertyId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !category) return;
		this.loading.set(true);
		this.loadFailed.set(false);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, category };
			if (propertyId) params["property_id"] = propertyId;
			const rows = await this.api.get<ReasonCodeListItem[] | { data: ReasonCodeListItem[] }>(
				"/reason-codes",
				params,
			);
			this.codes.set(Array.isArray(rows) ? rows : (rows?.data ?? []));
		} catch {
			// The message is rendered above; swallowing it here keeps a dialog
			// usable when only the picker failed.
			this.codes.set([]);
			this.loadFailed.set(true);
		} finally {
			this.loading.set(false);
		}
	}

	onPick(event: Event): void {
		this.valueChange.emit((event.target as HTMLSelectElement).value);
	}

	/** Whether the operator's own membership role clears this code's level. */
	clears(code: ReasonCodeListItem): boolean {
		return actorClearsApprovalLevel(
			this.auth.activeMembership()?.role ?? null,
			code.approval_level ?? null,
		);
	}

	/** The membership role the code demands, for the warning text. */
	minRole(code: ReasonCodeListItem): string {
		try {
			return approvalLevelMinRole(code.approval_level ?? null) ?? "";
		} catch {
			// A level no mapping covers. The handler refuses it outright; saying so
			// beats rendering an empty requirement.
			return code.approval_level ?? "";
		}
	}
}
