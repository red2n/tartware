/**
 * DEV DOC
 * Module: services/rate-service.ts
 * Purpose: Rate CRUD operations for rooms-service
 * Ownership: rooms-service
 */

import { type RateItem, RateItemSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";
import { buildDynamicUpdate, type UpdateField } from "../sql/dynamic-update-builder.js";
import {
  RATE_CREATE_SQL,
  RATE_DELETE_SQL,
  RATE_GET_BY_ID_SQL,
  RATE_LIST_SQL,
} from "../sql/rate-queries.js";

type RateRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_type_id: string;
  rate_name: string;
  rate_code: string;
  description: string | null;
  rate_type: string | null;
  strategy: string | null;
  priority: number | null;
  base_rate: number | null;
  currency: string | null;
  single_occupancy_rate: number | null;
  double_occupancy_rate: number | null;
  extra_person_rate: number | null;
  extra_child_rate: number | null;
  valid_from: string | Date | null;
  valid_until: string | Date | null;
  advance_booking_days_min: number | null;
  advance_booking_days_max: number | null;
  min_length_of_stay: number | null;
  max_length_of_stay: number | null;
  closed_to_arrival: boolean | null;
  closed_to_departure: boolean | null;
  meal_plan: string | null;
  meal_plan_cost: number | null;
  cancellation_policy: unknown | null;
  modifiers: unknown | null;
  channels: unknown | null;
  customer_segments: unknown | null;
  tax_inclusive: boolean | null;
  tax_rate: number | null;
  status: string | null;
  display_order: number | null;
  metadata: unknown | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  version: bigint | null;
};

const toStringDate = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const toDateString = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  return value;
};

const mapRowToRate = (row: RateRow): RateItem =>
  RateItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    room_type_id: row.room_type_id,
    rate_name: row.rate_name,
    rate_code: row.rate_code,
    description: row.description ?? undefined,
    rate_type: row.rate_type ?? "BAR",
    strategy: row.strategy ?? "FIXED",
    priority: row.priority ?? 100,
    base_rate: row.base_rate != null ? Number(row.base_rate) : 0,
    currency: row.currency ?? undefined,
    single_occupancy_rate:
      row.single_occupancy_rate != null ? Number(row.single_occupancy_rate) : undefined,
    double_occupancy_rate:
      row.double_occupancy_rate != null ? Number(row.double_occupancy_rate) : undefined,
    extra_person_rate: row.extra_person_rate != null ? Number(row.extra_person_rate) : undefined,
    extra_child_rate: row.extra_child_rate != null ? Number(row.extra_child_rate) : undefined,
    valid_from: toDateString(row.valid_from) ?? new Date().toISOString().split("T")[0],
    valid_until: toDateString(row.valid_until),
    advance_booking_days_min: row.advance_booking_days_min ?? undefined,
    advance_booking_days_max: row.advance_booking_days_max ?? undefined,
    min_length_of_stay: row.min_length_of_stay ?? undefined,
    max_length_of_stay: row.max_length_of_stay ?? undefined,
    closed_to_arrival: row.closed_to_arrival ?? undefined,
    closed_to_departure: row.closed_to_departure ?? undefined,
    meal_plan: row.meal_plan ?? undefined,
    meal_plan_cost: row.meal_plan_cost != null ? Number(row.meal_plan_cost) : undefined,
    cancellation_policy: row.cancellation_policy ?? undefined,
    modifiers: row.modifiers ?? undefined,
    channels: row.channels ?? undefined,
    customer_segments: row.customer_segments ?? undefined,
    tax_inclusive: row.tax_inclusive ?? undefined,
    tax_rate: row.tax_rate != null ? Number(row.tax_rate) : undefined,
    status: row.status ?? "ACTIVE",
    display_order: row.display_order ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: toStringDate(row.created_at),
    updated_at: toStringDate(row.updated_at),
    version: row.version ? row.version.toString() : "0",
  });

const toJson = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
};

type CreateRateInput = {
  tenant_id: string;
  property_id: string;
  room_type_id: string;
  rate_name: string;
  rate_code: string;
  description?: string;
  rate_type?: string;
  strategy?: string;
  priority?: number;
  base_rate: number;
  currency?: string;
  single_occupancy_rate?: number;
  double_occupancy_rate?: number;
  extra_person_rate?: number;
  extra_child_rate?: number;
  valid_from: string;
  valid_until?: string;
  advance_booking_days_min?: number;
  advance_booking_days_max?: number;
  min_length_of_stay?: number;
  max_length_of_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  meal_plan?: string;
  meal_plan_cost?: number;
  cancellation_policy?: unknown;
  modifiers?: unknown;
  channels?: unknown;
  customer_segments?: unknown;
  tax_inclusive?: boolean;
  tax_rate?: number;
  status?: string;
  display_order?: number;
  metadata?: unknown;
  created_by?: string;
};

/**
 * List rates with optional filters.
 */
export const listRates = async (options: {
  tenantId: string;
  propertyId?: string;
  roomTypeId?: string;
  status?: string;
  rateType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RateItem[]> => {
  const { rows } = await query<RateRow>(RATE_LIST_SQL, [
    options.tenantId,
    options.propertyId ?? null,
    options.roomTypeId ?? null,
    options.status ?? null,
    options.rateType ?? null,
    options.search ? `%${options.search.trim()}%` : null,
    options.limit ?? 200,
    options.offset ?? 0,
  ]);

  return rows.map(mapRowToRate);
};

/**
 * Get a rate by ID.
 */
export const getRateById = async (options: {
  rateId: string;
  tenantId: string;
}): Promise<RateItem | null> => {
  const { rows } = await query<RateRow>(RATE_GET_BY_ID_SQL, [options.rateId, options.tenantId]);

  if (!rows[0]) {
    return null;
  }

  return mapRowToRate(rows[0]);
};

/**
 * Create a new rate.
 */
export const createRate = async (input: CreateRateInput): Promise<RateItem> => {
  const { rows } = await query<RateRow>(RATE_CREATE_SQL, [
    input.tenant_id,
    input.property_id,
    input.room_type_id,
    input.rate_name,
    input.rate_code,
    input.description ?? null,
    input.rate_type ?? null,
    input.strategy ?? null,
    input.priority ?? null,
    input.base_rate,
    input.currency ?? null,
    input.single_occupancy_rate ?? null,
    input.double_occupancy_rate ?? null,
    input.extra_person_rate ?? null,
    input.extra_child_rate ?? null,
    input.valid_from,
    input.valid_until ?? null,
    input.advance_booking_days_min ?? null,
    input.advance_booking_days_max ?? null,
    input.min_length_of_stay ?? null,
    input.max_length_of_stay ?? null,
    input.closed_to_arrival ?? null,
    input.closed_to_departure ?? null,
    input.meal_plan ?? null,
    input.meal_plan_cost ?? null,
    toJson(input.cancellation_policy),
    toJson(input.modifiers),
    toJson(input.channels),
    toJson(input.customer_segments),
    input.tax_inclusive ?? null,
    input.tax_rate ?? null,
    input.status ?? null,
    input.display_order ?? null,
    toJson(input.metadata),
    input.created_by ?? null,
  ]);

  if (!rows[0]) {
    throw new Error("Failed to create rate");
  }
  return mapRowToRate(rows[0]);
};

type UpdateRateInput = {
  tenant_id: string;
  rate_id: string;
  property_id?: string;
  room_type_id?: string;
  rate_name?: string;
  rate_code?: string;
  description?: string;
  rate_type?: string;
  strategy?: string;
  priority?: number;
  base_rate?: number;
  currency?: string;
  single_occupancy_rate?: number;
  double_occupancy_rate?: number;
  extra_person_rate?: number;
  extra_child_rate?: number;
  valid_from?: string;
  valid_until?: string;
  advance_booking_days_min?: number;
  advance_booking_days_max?: number;
  min_length_of_stay?: number;
  max_length_of_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  meal_plan?: string;
  meal_plan_cost?: number;
  cancellation_policy?: unknown;
  modifiers?: unknown;
  channels?: unknown;
  customer_segments?: unknown;
  tax_inclusive?: boolean;
  tax_rate?: number;
  status?: string;
  display_order?: number;
  metadata?: unknown;
  updated_by?: string;
};

/**
 * Column mappings for rate updates.
 * Key = property on UpdateRateInput; column = DB column; json = needs JSON.stringify.
 */
const RATE_UPDATE_FIELDS: ReadonlyArray<{
  key: keyof UpdateRateInput;
  column: string;
  json?: boolean;
}> = [
  { key: "property_id", column: "property_id" },
  { key: "room_type_id", column: "room_type_id" },
  { key: "rate_name", column: "rate_name" },
  { key: "rate_code", column: "rate_code" },
  { key: "description", column: "description" },
  { key: "rate_type", column: "rate_type" },
  { key: "strategy", column: "strategy" },
  { key: "priority", column: "priority" },
  { key: "base_rate", column: "base_rate" },
  { key: "currency", column: "currency" },
  { key: "single_occupancy_rate", column: "single_occupancy_rate" },
  { key: "double_occupancy_rate", column: "double_occupancy_rate" },
  { key: "extra_person_rate", column: "extra_person_rate" },
  { key: "extra_child_rate", column: "extra_child_rate" },
  { key: "valid_from", column: "valid_from" },
  { key: "valid_until", column: "valid_until" },
  { key: "advance_booking_days_min", column: "advance_booking_days_min" },
  { key: "advance_booking_days_max", column: "advance_booking_days_max" },
  { key: "min_length_of_stay", column: "min_length_of_stay" },
  { key: "max_length_of_stay", column: "max_length_of_stay" },
  { key: "closed_to_arrival", column: "closed_to_arrival" },
  { key: "closed_to_departure", column: "closed_to_departure" },
  { key: "meal_plan", column: "meal_plan" },
  { key: "meal_plan_cost", column: "meal_plan_cost" },
  { key: "cancellation_policy", column: "cancellation_policy", json: true },
  { key: "modifiers", column: "modifiers", json: true },
  { key: "channels", column: "channels", json: true },
  { key: "customer_segments", column: "customer_segments", json: true },
  { key: "tax_inclusive", column: "tax_inclusive" },
  { key: "tax_rate", column: "tax_rate" },
  { key: "status", column: "status" },
  { key: "display_order", column: "display_order" },
  { key: "metadata", column: "metadata", json: true },
  { key: "updated_by", column: "updated_by" },
];

/** Columns returned from the UPDATE CTE. */
const RATE_SELECT_COLUMNS = [
  "id",
  "tenant_id",
  "property_id",
  "room_type_id",
  "rate_name",
  "rate_code",
  "description",
  "rate_type",
  "strategy",
  "priority",
  "base_rate",
  "currency",
  "single_occupancy_rate",
  "double_occupancy_rate",
  "extra_person_rate",
  "extra_child_rate",
  "valid_from",
  "valid_until",
  "advance_booking_days_min",
  "advance_booking_days_max",
  "min_length_of_stay",
  "max_length_of_stay",
  "closed_to_arrival",
  "closed_to_departure",
  "meal_plan",
  "meal_plan_cost",
  "cancellation_policy",
  "modifiers",
  "channels",
  "customer_segments",
  "tax_inclusive",
  "tax_rate",
  "status",
  "display_order",
  "metadata",
  "created_at",
  "updated_at",
  "version",
] as const;

/**
 * Update a rate by id.
 *
 * Uses a dynamic query builder so that only explicitly provided fields are
 * included in the SET clause. This distinguishes "not provided" (undefined →
 * column untouched) from "set to null" (null → column cleared), unlike the
 * former COALESCE($n, alias.column) approach.
 */
export const updateRate = async (input: UpdateRateInput): Promise<RateItem | null> => {
  const fields: UpdateField[] = [];
  for (const mapping of RATE_UPDATE_FIELDS) {
    const value = input[mapping.key];
    if (value !== undefined) {
      fields.push({
        column: mapping.column,
        value: mapping.json ? toJson(value) : value,
      });
    }
  }

  const { sql, params } = buildDynamicUpdate({
    table: "public.rates",
    alias: "r",
    id: input.rate_id,
    tenantId: input.tenant_id,
    fields,
    selectColumns: RATE_SELECT_COLUMNS,
  });

  const { rows } = await query<RateRow>(sql, params);

  if (!rows[0]) {
    return null;
  }

  return mapRowToRate(rows[0]);
};

/**
 * Soft delete a rate by id.
 */
export const deleteRate = async (options: {
  tenant_id: string;
  rate_id: string;
  deleted_by?: string;
}): Promise<boolean> => {
  const { rows } = await query<{ id: string }>(RATE_DELETE_SQL, [
    options.rate_id,
    options.tenant_id,
    options.deleted_by ?? null,
  ]);

  return Boolean(rows[0]?.id);
};
