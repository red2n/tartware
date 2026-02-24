import type { UserUiPreferences } from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  GET_UI_PREFERENCES_SQL,
  UPSERT_UI_PREFERENCES_SQL,
} from "../sql/ui-preferences-queries.js";

type UiPreferencesRow = {
  preference_id: string;
  tenant_id: string;
  user_id: string;
  theme: string | null;
  language: string | null;
  timezone: string | null;
  date_format: string | null;
  time_format: string | null;
  currency_display: string | null;
  home_page: string | null;
  home_page_dashboard_layout: Record<string, unknown>[] | null;
  default_page_size: number | null;
  default_sort_field: string | null;
  default_sort_direction: string | null;
  notification_sound_enabled: boolean | null;
  notification_desktop_enabled: boolean | null;
  notification_email_digest: string | null;
  pinned_reports: Record<string, unknown>[] | null;
  recent_searches: Record<string, unknown>[] | null;
  favorite_properties: string[] | null;
  profile_display_fields: string[] | null;
  profile_history_display: string | null;
  default_profile_tab: string | null;
  created_at: Date;
  updated_at: Date;
};

const mapRow = (row: UiPreferencesRow): UserUiPreferences => ({
  preference_id: row.preference_id,
  tenant_id: row.tenant_id,
  user_id: row.user_id,
  theme: (row.theme as UserUiPreferences["theme"]) ?? "SYSTEM",
  language: row.language ?? "en",
  timezone: row.timezone ?? undefined,
  date_format: row.date_format ?? "YYYY-MM-DD",
  time_format: (row.time_format as UserUiPreferences["time_format"]) ?? "24H",
  currency_display: (row.currency_display as UserUiPreferences["currency_display"]) ?? "SYMBOL",
  home_page: row.home_page ?? "/dashboard",
  home_page_dashboard_layout: row.home_page_dashboard_layout ?? [],
  default_page_size: row.default_page_size ?? 25,
  default_sort_field: row.default_sort_field ?? undefined,
  default_sort_direction:
    (row.default_sort_direction as UserUiPreferences["default_sort_direction"]) ?? "ASC",
  notification_sound_enabled: row.notification_sound_enabled ?? true,
  notification_desktop_enabled: row.notification_desktop_enabled ?? true,
  notification_email_digest:
    (row.notification_email_digest as UserUiPreferences["notification_email_digest"]) ??
    "IMMEDIATE",
  pinned_reports: row.pinned_reports ?? [],
  recent_searches: row.recent_searches ?? [],
  favorite_properties: row.favorite_properties ?? [],
  profile_display_fields: row.profile_display_fields ?? [],
  profile_history_display:
    (row.profile_history_display as UserUiPreferences["profile_history_display"]) ?? "COMPACT",
  default_profile_tab: row.default_profile_tab ?? "OVERVIEW",
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/**
 * Fetch UI preferences for a user within a tenant.
 * Returns null if no preferences have been saved yet.
 */
export const getUiPreferences = async (
  userId: string,
  tenantId: string,
): Promise<UserUiPreferences | null> => {
  const { rows } = await query<UiPreferencesRow>(GET_UI_PREFERENCES_SQL, [userId, tenantId]);
  const row = rows[0];
  return row ? mapRow(row) : null;
};

/**
 * Upsert UI preferences for a user within a tenant.
 * Performs INSERT ... ON CONFLICT UPDATE so caller can send partial updates.
 */
export const upsertUiPreferences = async (
  tenantId: string,
  userId: string,
  data: Partial<
    Omit<UserUiPreferences, "preference_id" | "tenant_id" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<UserUiPreferences> => {
  const { rows } = await query<UiPreferencesRow>(UPSERT_UI_PREFERENCES_SQL, [
    tenantId,
    userId,
    data.theme ?? null,
    data.language ?? null,
    data.timezone ?? null,
    data.date_format ?? null,
    data.time_format ?? null,
    data.currency_display ?? null,
    data.home_page ?? null,
    data.home_page_dashboard_layout !== undefined
      ? JSON.stringify(data.home_page_dashboard_layout)
      : null,
    data.default_page_size ?? null,
    data.default_sort_field ?? null,
    data.default_sort_direction ?? null,
    data.notification_sound_enabled ?? null,
    data.notification_desktop_enabled ?? null,
    data.notification_email_digest ?? null,
    data.pinned_reports !== undefined ? JSON.stringify(data.pinned_reports) : null,
    data.recent_searches !== undefined ? JSON.stringify(data.recent_searches) : null,
    data.favorite_properties ?? null,
    data.profile_display_fields !== undefined ? JSON.stringify(data.profile_display_fields) : null,
    data.profile_history_display ?? null,
    data.default_profile_tab ?? null,
  ]);

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to upsert UI preferences");
  }
  return mapRow(row);
};
