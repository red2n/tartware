import type { SettingValueRow } from "@tartware/schemas";
import type { FastifyBaseLogger } from "fastify";

import { config } from "../config.js";

type BusinessCalendarSettings = {
  autoRollEnabled: boolean;
  autoRollTime: string; // HH:MM
  dayStartTime: string; // HH:MM
};

export class BusinessCalendarSettingsService {
  /** Map<propertyId, settings> */
  private propertyCache = new Map<string, BusinessCalendarSettings>();
  /** Map<tenantId, settings> */
  private tenantCache = new Map<string, BusinessCalendarSettings>();

  private readonly DEFAULT_SETTINGS: BusinessCalendarSettings = {
    autoRollEnabled: true,
    autoRollTime: "03:00",
    dayStartTime: "03:00",
  };

  constructor(private logger: FastifyBaseLogger) {}

  /**
   * Load settings for all properties of all tenants.
   */
  async loadAllSettings(): Promise<void> {
    this.logger.info("Loading business calendar settings for all properties...");

    try {
      const codes = [
        "FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_ENABLED",
        "FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_TIME",
        "FINANCE.BUSINESS_CALENDAR.DAY_START_TIME",
      ];

      const url = new URL(`${config.coreServiceUrl}/v1/settings/values`);
      for (const code of codes) {
        url.searchParams.append("setting_codes", code);
      }
      url.searchParams.append("active_only", "true");

      const response = await fetch(url.toString(), {
        headers: {
          "x-internal-service": "billing-service",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch settings from core-service: ${response.status} ${response.statusText}`,
        );
      }

      const { data } = (await response.json()) as { data: SettingValueRow[] };
      this.processSettings(data);

      this.logger.info(
        {
          propertyOverrides: this.propertyCache.size,
          tenantDefaults: this.tenantCache.size,
        },
        "Business calendar settings loaded successfully",
      );
    } catch (error) {
      this.logger.error(error, "Failed to load business calendar settings; using system defaults");
    }
  }

  private processSettings(rows: SettingValueRow[]): void {
    // Clear caches before reload
    this.propertyCache.clear();
    this.tenantCache.clear();

    for (const row of rows) {
      const { tenant_id, property_id, setting_code, value } = row;
      const actualValue = this.extractValue(value);

      if (property_id) {
        // Property scope
        const settings = this.propertyCache.get(property_id) || { ...this.DEFAULT_SETTINGS };
        this.applyValue(settings, setting_code, actualValue);
        this.propertyCache.set(property_id, settings);
      } else {
        // Tenant scope
        const settings = this.tenantCache.get(tenant_id) || { ...this.DEFAULT_SETTINGS };
        this.applyValue(settings, setting_code, actualValue);
        this.tenantCache.set(tenant_id, settings);
      }
    }
  }

  private extractValue(value: unknown): unknown {
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }

  private applyValue(settings: BusinessCalendarSettings, code: string, value: unknown): void {
    switch (code) {
      case "FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_ENABLED":
        settings.autoRollEnabled = Boolean(value);
        break;
      case "FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_TIME":
        if (typeof value === "string") settings.autoRollTime = value;
        break;
      case "FINANCE.BUSINESS_CALENDAR.DAY_START_TIME":
        if (typeof value === "string") settings.dayStartTime = value;
        break;
    }
  }

  /**
   * Get resolved settings for a property, following inheritance (Property -> Tenant -> System Default).
   */
  getSettings(tenantId: string, propertyId: string): BusinessCalendarSettings {
    const propertySettings = this.propertyCache.get(propertyId);
    const tenantSettings = this.tenantCache.get(tenantId);

    return {
      autoRollEnabled:
        propertySettings?.autoRollEnabled ??
        tenantSettings?.autoRollEnabled ??
        this.DEFAULT_SETTINGS.autoRollEnabled,
      autoRollTime:
        propertySettings?.autoRollTime ??
        tenantSettings?.autoRollTime ??
        this.DEFAULT_SETTINGS.autoRollTime,
      dayStartTime:
        propertySettings?.dayStartTime ??
        tenantSettings?.dayStartTime ??
        this.DEFAULT_SETTINGS.dayStartTime,
    };
  }

  /**
   * Handle hot-reload from Kafka event (settings.value.set)
   */
  async handleHotReload(
    tenantId: string,
    propertyId: string | null,
    code: string,
    value: unknown,
  ): Promise<void> {
    const codes = [
      "FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_ENABLED",
      "FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_TIME",
      "FINANCE.BUSINESS_CALENDAR.DAY_START_TIME",
    ];

    if (!codes.includes(code)) return;

    this.logger.info(
      { tenantId, propertyId, code, value },
      "Hot-reloading business calendar setting",
    );

    const actualValue = this.extractValue(value);

    if (propertyId) {
      const settings =
        this.propertyCache.get(propertyId) || (await this.fetchPropertySettings(tenantId));
      this.applyValue(settings, code, actualValue);
      this.propertyCache.set(propertyId, settings);
    } else {
      const settings = this.tenantCache.get(tenantId) || (await this.fetchTenantSettings());
      this.applyValue(settings, code, actualValue);
      this.tenantCache.set(tenantId, settings);
    }
  }

  private async fetchPropertySettings(tenantId: string): Promise<BusinessCalendarSettings> {
    // Basic implementation: if we don't have it in cache, we should probably fetch all for that property.
    // For simplicity, we'll return a copy of the tenant default or system default.
    const tenantDefault = this.tenantCache.get(tenantId);
    return tenantDefault ? { ...tenantDefault } : { ...this.DEFAULT_SETTINGS };
  }

  private async fetchTenantSettings(): Promise<BusinessCalendarSettings> {
    return { ...this.DEFAULT_SETTINGS };
  }
}
