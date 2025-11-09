import { computed, Injectable, signal } from '@angular/core';
import type { PropertyWithStats } from '@tartware/schemas';

/**
 * Property Context Service
 * Manages the currently selected property for filtering PMS data
 *
 * This service acts as a central state store for property selection,
 * allowing all PMS components to react to property changes.
 */
@Injectable({
  providedIn: 'root',
})
export class PropertyContextService {
  // Selected property ID ('all' or specific property ID)
  private _selectedPropertyId = signal<string>('all');

  // All available properties for current tenant
  private _properties = signal<PropertyWithStats[]>([]);

  /**
   * Currently selected property ID
   */
  readonly selectedPropertyId = this._selectedPropertyId.asReadonly();

  /**
   * All available properties
   */
  readonly properties = this._properties.asReadonly();

  /**
   * Currently selected property (or null if 'all')
   */
  readonly selectedProperty = computed(() => {
    const id = this._selectedPropertyId();
    if (id === 'all') return null;
    return this._properties().find((p) => p.id === id) ?? null;
  });

  /**
   * Whether a specific property is selected (not 'all')
   */
  readonly hasPropertyFilter = computed(() => this._selectedPropertyId() !== 'all');

  /**
   * Set available properties for current tenant
   */
  setProperties(properties: PropertyWithStats[]): void {
    this._properties.set(properties);

    // Auto-select first property if available
    if (properties.length > 0 && this._selectedPropertyId() === 'all') {
      this._selectedPropertyId.set(properties[0].id);
    }
  }

  /**
   * Select a property by ID
   */
  selectProperty(propertyId: string): void {
    this._selectedPropertyId.set(propertyId);
  }

  /**
   * Reset to 'all properties'
   */
  clearSelection(): void {
    this._selectedPropertyId.set('all');
  }

  /**
   * Clear all properties (when switching tenants)
   */
  clearProperties(): void {
    this._properties.set([]);
    this._selectedPropertyId.set('all');
  }
}
