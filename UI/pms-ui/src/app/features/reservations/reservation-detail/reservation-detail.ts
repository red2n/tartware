import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import type { ReservationDetail } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { reservationStatusClass } from "../../../shared/badge-utils";
import { formatCurrency, formatLongDate } from "../../../shared/format-utils";

type DetailRow = { label: string; value: string; badge?: string };

@Component({
	selector: "app-reservation-detail",
	standalone: true,
	imports: [NgClass, RouterLink, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
	templateUrl: "./reservation-detail.html",
	styleUrl: "./reservation-detail.scss",
})
export class ReservationDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly reservation = signal<ReservationDetail | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	statusClass = reservationStatusClass;

	readonly bookingRows = computed<DetailRow[]>(() => {
		const r = this.reservation();
		if (!r) return [];
		return [
			{ label: "Confirmation #", value: r.confirmation_number },
			{
				label: "Status",
				value: r.status_display,
				badge: this.statusClass(r.status),
			},
			{ label: "Check-in", value: this.formatDate(r.check_in_date) },
			{ label: "Check-out", value: this.formatDate(r.check_out_date) },
			{ label: "Nights", value: String(r.nights) },
			{ label: "Room Type", value: r.room_type_name ?? "—" },
			{ label: "Room", value: r.room_number ?? "Not assigned" },
			{ label: "Source", value: r.source ?? "—" },
			{ label: "Type", value: r.reservation_type ?? "—" },
		];
	});

	readonly guestRows = computed<DetailRow[]>(() => {
		const r = this.reservation();
		if (!r) return [];
		return [
			{ label: "Guest Name", value: r.guest_name ?? "—" },
			{ label: "Email", value: r.guest_email ?? "—" },
			{ label: "Phone", value: r.guest_phone ?? "—" },
		];
	});

	readonly financialRows = computed<DetailRow[]>(() => {
		const r = this.reservation();
		if (!r) return [];
		const fmt = (n: number) => this.formatCurrency(n, r.currency);
		return [
			{ label: "Room Rate", value: fmt(r.room_rate) },
			{ label: "Total Amount", value: fmt(r.total_amount) },
			{ label: "Tax", value: fmt(r.tax_amount) },
			{ label: "Discount", value: fmt(r.discount_amount) },
			{ label: "Paid", value: fmt(r.paid_amount) },
			{
				label: "Balance Due",
				value: fmt(r.balance_due),
				badge: r.balance_due > 0 ? "badge-warning" : "badge-success",
			},
		];
	});

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get("reservationId");
		if (id) {
			this.loadReservation(id);
		}
	}

	async loadReservation(id: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const res = await this.api.get<ReservationDetail>(`/reservations/${id}`, {
				tenant_id: tenantId,
			});
			this.reservation.set(res);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load reservation");
		} finally {
			this.loading.set(false);
		}
	}

	goBack(): void {
		this.router.navigate(["/reservations"]);
	}

	formatDate = formatLongDate;
	formatCurrency = formatCurrency;
}
