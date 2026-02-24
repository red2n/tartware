import { Component, computed, inject, type OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { roomStatusClass, housekeepingStatusClass } from '../../../shared/badge-utils';

type RoomDetail = {
  room_id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  room_type_id?: string;
  room_type_name?: string;
  room_type_amenities?: string[];
  room_number: string;
  room_name?: string;
  floor?: string;
  building?: string;
  wing?: string;
  status: string;
  status_display: string;
  housekeeping_status: string;
  housekeeping_display: string;
  maintenance_status: string;
  maintenance_display: string;
  features?: Record<string, unknown>;
  amenities?: string[];
  is_blocked: boolean;
  block_reason?: string;
  is_out_of_order: boolean;
  out_of_order_reason?: string;
  expected_ready_date?: string;
  housekeeping_notes?: string;
  updated_at?: string;
  version: string;
};

type CatalogItem = {
  amenity_code: string;
  display_name: string;
  category: string;
  icon: string | null;
};

type DetailRow = { label: string; value: string; badge?: string };

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, MatSlideToggleModule],
  templateUrl: './room-detail.html',
  styleUrl: './room-detail.scss',
})
export class RoomDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly room = signal<RoomDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveSuccess = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly activating = signal(false);

  /** Editable OOO state */
  readonly editOoo = signal(false);
  readonly editOooReason = signal('');
  readonly editExpectedReady = signal('');

  /** Whether the OOO toggle has been changed from the loaded state */
  readonly hasOooChanges = computed(() => {
    const r = this.room();
    if (!r) return false;
    return this.editOoo() !== r.is_out_of_order || this.editOooReason() !== (r.out_of_order_reason ?? '') || this.editExpectedReady() !== (r.expected_ready_date?.substring(0, 10) ?? '');
  });

  constructor() {}

  readonly infoRows = computed<DetailRow[]>(() => {
    const r = this.room();
    if (!r) return [];
    return [
      { label: 'Room Number', value: r.room_number },
      { label: 'Room Name', value: r.room_name ?? '—' },
      { label: 'Room Type', value: r.room_type_name ?? '—' },
      { label: 'Floor', value: r.floor ?? '—' },
      { label: 'Building', value: r.building ?? '—' },
      { label: 'Wing', value: r.wing ?? '—' },
      { label: 'Property', value: r.property_name ?? '—' },
    ].filter((row) => row.value !== '—');
  });

  readonly statusRows = computed<DetailRow[]>(() => {
    const r = this.room();
    if (!r) return [];
    const rows: DetailRow[] = [
      { label: 'Status', value: r.status_display, badge: this.statusClass(r.status) },
      {
        label: 'Housekeeping',
        value: r.housekeeping_display,
        badge: this.hkClass(r.housekeeping_status),
      },
      { label: 'Maintenance', value: r.maintenance_display },
    ];
    if (r.is_blocked) {
      rows.push({ label: 'Blocked', value: r.block_reason ?? 'Yes', badge: 'badge-warning' });
    }
    if (r.is_out_of_order) {
      rows.push({
        label: 'Out of Order',
        value: r.out_of_order_reason ?? 'Yes',
        badge: 'badge-danger',
      });
    }
    if (r.expected_ready_date) {
      rows.push({ label: 'Expected Ready', value: r.expected_ready_date });
    }
    if (r.housekeeping_notes) {
      rows.push({ label: 'HK Notes', value: r.housekeeping_notes });
    }
    return rows;
  });

  readonly amenitiesList = computed<string[]>(() => {
    const r = this.room();
    return r?.amenities ?? r?.room_type_amenities ?? [];
  });

  /** Amenity catalog from backend */
  readonly catalog = signal<CatalogItem[]>([]);

  /** Editable amenities — initialized from room data */
  readonly editAmenities = signal<string[]>([]);

  /** Whether amenity editing mode is active */
  readonly editingAmenities = signal(false);

  /** New custom amenity input */
  readonly newAmenityInput = signal('');

  /** Saving amenities in progress */
  readonly savingAmenities = signal(false);

  /** Amenity save feedback */
  readonly amenitySuccess = signal<string | null>(null);
  readonly amenityError = signal<string | null>(null);

  /** All known amenity codes (catalog + room type) for display in edit mode */
  readonly availableAmenities = computed(() => {
    const roomType = this.room()?.room_type_amenities ?? [];
    const catalogCodes = this.catalog().map((c) => c.amenity_code);
    const current = this.editAmenities();
    // Merge all unique codes: catalog + room type + currently assigned
    const all = new Set([...catalogCodes, ...roomType, ...current]);
    return [...all];
  });

  /** Map amenity codes to display names from catalog */
  readonly amenityDisplayMap = computed(() => {
    const map = new Map<string, string>();
    for (const item of this.catalog()) {
      map.set(item.amenity_code, item.display_name);
    }
    return map;
  });

  /** Whether there are amenity changes to save */
  readonly hasAmenityChanges = computed(() => {
    const r = this.room();
    if (!r) return false;
    const original = r.amenities ?? r.room_type_amenities ?? [];
    const current = this.editAmenities();
    if (original.length !== current.length) return true;
    const origSet = new Set(original);
    return current.some((a) => !origSet.has(a));
  });

  ngOnInit(): void {
    const roomId = this.route.snapshot.paramMap.get('roomId');
    if (roomId) {
      this.loadRoom(roomId);
    }
  }

  statusClass = roomStatusClass;
  hkClass = housekeepingStatusClass;

  goBack(): void {
    this.router.navigate(['/rooms']);
  }

  async loadRoom(roomId: string): Promise<void> {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const room = await this.api.get<RoomDetail>(`/rooms/${roomId}`, { tenant_id: tenantId });
      this.room.set(room);
      // Sync editable OOO state from loaded room data
      this.editOoo.set(room.is_out_of_order);
      this.editOooReason.set(room.out_of_order_reason ?? '');
      this.editExpectedReady.set(room.expected_ready_date?.substring(0, 10) ?? '');
      // Initialize editable amenities from room data
      this.editAmenities.set([...(room.amenities ?? room.room_type_amenities ?? [])]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load room');
    } finally {
      this.loading.set(false);
    }
  }

  startEditAmenities(): void {
    const r = this.room();
    if (!r) return;
    this.editAmenities.set([...(r.amenities ?? r.room_type_amenities ?? [])]);
    this.amenitySuccess.set(null);
    this.amenityError.set(null);
    this.editingAmenities.set(true);
    this.loadCatalog();
  }

  cancelEditAmenities(): void {
    this.editingAmenities.set(false);
    this.newAmenityInput.set('');
  }

  toggleAmenity(code: string): void {
    const current = this.editAmenities();
    if (current.includes(code)) {
      this.editAmenities.set(current.filter((a) => a !== code));
    } else {
      this.editAmenities.set([...current, code]);
    }
  }

  private static readonly AMENITY_CODE_PATTERN = /^[A-Z0-9_]{1,50}$/;

  addCustomAmenity(): void {
    const raw = this.newAmenityInput().trim().toUpperCase().replace(/\s+/g, '_');
    if (!raw) return;
    if (!RoomDetailComponent.AMENITY_CODE_PATTERN.test(raw)) {
      this.amenityError.set('Amenity code must be 1–50 characters: letters, digits, and underscores only.');
      return;
    }
    const current = this.editAmenities();
    if (!current.includes(raw)) {
      this.editAmenities.set([...current, raw]);
    }
    this.newAmenityInput.set('');
  }

  removeAmenity(code: string): void {
    this.editAmenities.set(this.editAmenities().filter((a) => a !== code));
  }

  async loadCatalog(): Promise<void> {
    if (this.catalog().length > 0) return;
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;
    try {
      const items = await this.api.get<CatalogItem[]>('/rooms/amenity-catalog', { tenant_id: tenantId });
      this.catalog.set(items);
    } catch {
      // Catalog load failure is non-critical - editing still works
    }
  }

  async saveAmenities(): Promise<void> {
    const r = this.room();
    const tenantId = this.auth.tenantId();
    if (!r || !tenantId) return;

    this.savingAmenities.set(true);
    this.amenityError.set(null);
    this.amenitySuccess.set(null);

    try {
      await this.api.put(`/rooms/${r.room_id}`, {
        tenant_id: tenantId,
        amenities: this.editAmenities(),
      });
      this.amenitySuccess.set('Amenities updated.');
      this.editingAmenities.set(false);
      await this.loadRoom(r.room_id);
    } catch (e) {
      this.amenityError.set(e instanceof Error ? e.message : 'Failed to update amenities');
    } finally {
      this.savingAmenities.set(false);
    }
  }

  async saveOooStatus(): Promise<void> {
    const r = this.room();
    const tenantId = this.auth.tenantId();
    if (!r || !tenantId) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    try {
      if (this.editOoo()) {
        // Mark out of order
        await this.api.post(`/tenants/${tenantId}/rooms/${r.room_id}/out-of-order`, {
          reason: this.editOooReason() || undefined,
          expected_ready_date: this.editExpectedReady() || undefined,
        });
        this.saveSuccess.set('Room marked as Out of Order.');
      } else {
        // Clear out of order → set status to AVAILABLE
        await this.api.post(`/tenants/${tenantId}/rooms/${r.room_id}/status`, {
          status: 'AVAILABLE',
        });
        this.saveSuccess.set('Room restored to Available.');
      }
      // Reload room data — poll until status reflects the change (command is async via Kafka)
      await this.pollRoomUntilChanged(r.room_id, r.is_out_of_order !== this.editOoo());
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'Failed to update room');
    } finally {
      this.saving.set(false);
    }
  }

  async activateRoom(): Promise<void> {
    const r = this.room();
    const tenantId = this.auth.tenantId();
    if (!r || !tenantId) return;

    this.activating.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    try {
      await this.api.post(`/rooms/${r.room_id}/activate`, { tenant_id: tenantId });
      this.saveSuccess.set('Room activated and ready for booking.');
      await this.loadRoom(r.room_id);
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'Failed to activate room');
    } finally {
      this.activating.set(false);
    }
  }

  readonly deactivating = signal(false);

  /**
   * Poll room data until the OOO flag reflects the expected change, with a maximum of 5 attempts.
   */
  private async pollRoomUntilChanged(roomId: string, expectOooChanged: boolean): Promise<void> {
    const maxAttempts = 5;
    const intervalMs = 800;
    const previousOoo = this.room()?.is_out_of_order;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      await this.loadRoom(roomId);
      const current = this.room();
      if (current && expectOooChanged && current.is_out_of_order !== previousOoo) {
        return; // Change detected
      }
      if (current && !expectOooChanged) {
        return; // Just needed a reload
      }
    }
    // Final reload even if change wasn't detected
  }

  async deactivateRoom(): Promise<void> {
    const r = this.room();
    const tenantId = this.auth.tenantId();
    if (!r || !tenantId) return;

    this.deactivating.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    try {
      await this.api.post(`/rooms/${r.room_id}/deactivate`, { tenant_id: tenantId });
      this.saveSuccess.set('Room moved back to Setup mode.');
      await this.loadRoom(r.room_id);
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'Failed to deactivate room');
    } finally {
      this.deactivating.set(false);
    }
  }
}
