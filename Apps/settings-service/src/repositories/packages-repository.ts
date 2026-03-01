import { PackageComponentListItemSchema, PackageListItemSchema } from "@tartware/schemas";
import type { z } from "zod";

import { query } from "../lib/db.js";

// =====================================================
// PACKAGE QUERIES
// =====================================================

const PACKAGE_LIST_SQL = `
  SELECT
    p.package_id,
    p.tenant_id,
    p.property_id,
    pr.property_name,
    p.package_name,
    p.package_code,
    p.package_type,
    p.short_description,
    p.valid_from,
    p.valid_to,
    CASE WHEN CURRENT_DATE BETWEEN p.valid_from AND p.valid_to THEN true ELSE false END as is_currently_valid,
    p.min_nights,
    p.max_nights,
    p.min_guests,
    p.max_guests,
    p.pricing_model,
    p.base_price,
    p.discount_percentage,
    p.includes_breakfast,
    p.includes_lunch,
    p.includes_dinner,
    p.includes_parking,
    p.includes_wifi,
    p.includes_airport_transfer,
    p.refundable,
    p.free_cancellation_days,
    p.available_inventory,
    p.total_inventory,
    p.sold_count,
    p.is_active,
    p.is_published,
    p.is_featured,
    p.total_bookings,
    p.total_revenue,
    p.average_rating,
    p.badge_text,
    p.image_urls,
    p.created_at,
    p.updated_at
  FROM public.packages p
  LEFT JOIN public.properties pr ON p.property_id = pr.id
  WHERE COALESCE(p.is_deleted, false) = false
    AND ($2::uuid IS NULL OR p.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR p.property_id = $3::uuid)
    AND ($4::text IS NULL OR p.package_type = LOWER($4::text))
    AND ($5::boolean IS NULL OR p.is_active = $5::boolean)
    AND ($6::boolean IS NULL OR p.is_published = $6::boolean)
    AND ($7::boolean IS NULL OR p.is_featured = $7::boolean)
    AND (
      $8::date IS NULL
      OR (p.valid_from <= $8::date AND p.valid_to >= $8::date)
    )
  ORDER BY p.is_featured DESC, p.display_order ASC, p.package_name ASC
  LIMIT $1
`;

const PACKAGE_BY_ID_SQL = `
  SELECT
    p.package_id,
    p.tenant_id,
    p.property_id,
    pr.property_name,
    p.package_name,
    p.package_code,
    p.package_type,
    p.short_description,
    p.full_description,
    p.marketing_description,
    p.terms_and_conditions,
    p.valid_from,
    p.valid_to,
    p.blackout_dates,
    CASE WHEN CURRENT_DATE BETWEEN p.valid_from AND p.valid_to THEN true ELSE false END as is_currently_valid,
    p.min_nights,
    p.max_nights,
    p.min_advance_booking_days,
    p.max_advance_booking_days,
    p.min_guests,
    p.max_guests,
    p.pricing_model,
    p.base_price,
    p.adult_price,
    p.child_price,
    p.extra_person_charge,
    p.single_supplement,
    p.discount_percentage,
    p.discount_amount,
    p.commissionable,
    p.commission_percentage,
    p.available_monday,
    p.available_tuesday,
    p.available_wednesday,
    p.available_thursday,
    p.available_friday,
    p.available_saturday,
    p.available_sunday,
    p.applicable_room_types,
    p.all_room_types,
    p.available_channels,
    p.cancellation_policy_id,
    p.refundable,
    p.free_cancellation_days,
    p.cancellation_fee_percentage,
    p.available_inventory,
    p.total_inventory,
    p.sold_count,
    p.includes_breakfast,
    p.includes_lunch,
    p.includes_dinner,
    p.includes_parking,
    p.includes_wifi,
    p.includes_airport_transfer,
    p.featured,
    p.display_order,
    p.image_urls,
    p.highlight_color,
    p.badge_text,
    p.tags,
    p.categories,
    p.target_audience,
    p.is_active,
    p.is_published,
    p.is_featured,
    p.require_approval,
    p.total_bookings,
    p.total_revenue,
    p.average_rating,
    p.conversion_rate,
    p.notes,
    p.internal_notes,
    p.created_at,
    p.created_by,
    p.updated_at,
    p.updated_by
  FROM public.packages p
  LEFT JOIN public.properties pr ON p.property_id = pr.id
  WHERE p.package_id = $1
    AND p.tenant_id = $2
    AND COALESCE(p.is_deleted, false) = false
`;

const PACKAGE_COMPONENTS_SQL = `
  SELECT
    c.component_id,
    c.package_id,
    c.component_type,
    c.component_name,
    c.component_description,
    c.quantity,
    c.pricing_type,
    c.unit_price,
    c.is_included,
    c.is_optional,
    c.is_mandatory,
    c.delivery_timing,
    c.delivery_location,
    c.display_order,
    c.is_active
  FROM public.package_components c
  WHERE c.package_id = $1
    AND c.is_active = true
  ORDER BY c.display_order ASC, c.component_name ASC
`;

// =====================================================
// TYPES
// =====================================================

type PackageRow = {
  package_id: string;
  tenant_id: string;
  property_id: string | null;
  property_name: string | null;
  package_name: string;
  package_code: string;
  package_type: string;
  short_description: string | null;
  valid_from: string | Date;
  valid_to: string | Date;
  is_currently_valid: boolean;
  min_nights: number;
  max_nights: number | null;
  min_guests: number;
  max_guests: number | null;
  pricing_model: string;
  base_price: number | string;
  discount_percentage: number | string | null;
  includes_breakfast: boolean;
  includes_lunch: boolean;
  includes_dinner: boolean;
  includes_parking: boolean;
  includes_wifi: boolean;
  includes_airport_transfer: boolean;
  refundable: boolean;
  free_cancellation_days: number | null;
  available_inventory: number | null;
  total_inventory: number | null;
  sold_count: number;
  is_active: boolean;
  is_published: boolean;
  is_featured: boolean;
  total_bookings: number;
  total_revenue: number | string | null;
  average_rating: number | string | null;
  badge_text: string | null;
  image_urls: string[] | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

type PackageComponentRow = {
  component_id: string;
  package_id: string;
  component_type: string;
  component_name: string;
  component_description: string | null;
  quantity: number;
  pricing_type: string;
  unit_price: number | string;
  is_included: boolean;
  is_optional: boolean;
  is_mandatory: boolean;
  delivery_timing: string | null;
  delivery_location: string | null;
  display_order: number;
  is_active: boolean;
};

// =====================================================
// HELPERS
// =====================================================

const toIsoString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isNaN(num) ? null : num;
};

const formatDisplayLabel = (value: string | null): string => {
  if (!value || typeof value !== "string") {
    return "Unknown";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const mapPackageRow = (row: PackageRow) => {
  return PackageListItemSchema.parse({
    package_id: row.package_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    property_name: row.property_name ?? undefined,
    package_name: row.package_name,
    package_code: row.package_code,
    package_type: row.package_type?.toLowerCase() ?? "custom",
    package_type_display: formatDisplayLabel(row.package_type),
    short_description: row.short_description,
    valid_from: (toIsoString(row.valid_from) ?? "").split("T")[0],
    valid_to: (toIsoString(row.valid_to) ?? "").split("T")[0],
    is_currently_valid: Boolean(row.is_currently_valid),
    min_nights: row.min_nights ?? 1,
    max_nights: row.max_nights,
    min_guests: row.min_guests ?? 1,
    max_guests: row.max_guests,
    pricing_model: row.pricing_model?.toLowerCase() ?? "per_night",
    pricing_model_display: formatDisplayLabel(row.pricing_model),
    base_price: toNumber(row.base_price) ?? 0,
    currency_code: "USD",
    discount_percentage: toNumber(row.discount_percentage),
    includes_breakfast: Boolean(row.includes_breakfast),
    includes_lunch: Boolean(row.includes_lunch),
    includes_dinner: Boolean(row.includes_dinner),
    includes_parking: Boolean(row.includes_parking),
    includes_wifi: Boolean(row.includes_wifi),
    includes_airport_transfer: Boolean(row.includes_airport_transfer),
    refundable: Boolean(row.refundable),
    free_cancellation_days: row.free_cancellation_days,
    available_inventory: row.available_inventory,
    total_inventory: row.total_inventory,
    sold_count: row.sold_count ?? 0,
    is_active: Boolean(row.is_active),
    is_published: Boolean(row.is_published),
    is_featured: Boolean(row.is_featured),
    total_bookings: row.total_bookings ?? 0,
    total_revenue: toNumber(row.total_revenue),
    average_rating: toNumber(row.average_rating),
    badge_text: row.badge_text,
    image_urls: row.image_urls,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

const mapPackageComponentRow = (row: PackageComponentRow) => {
  return PackageComponentListItemSchema.parse({
    component_id: row.component_id,
    package_id: row.package_id,
    component_type: row.component_type?.toLowerCase() ?? "service",
    component_type_display: formatDisplayLabel(row.component_type),
    component_name: row.component_name,
    component_description: row.component_description,
    quantity: row.quantity ?? 1,
    pricing_type: row.pricing_type?.toLowerCase() ?? "included",
    unit_price: toNumber(row.unit_price) ?? 0,
    is_included: Boolean(row.is_included),
    is_optional: Boolean(row.is_optional),
    is_mandatory: Boolean(row.is_mandatory),
    delivery_timing: row.delivery_timing,
    delivery_location: row.delivery_location,
    display_order: row.display_order ?? 0,
    is_active: Boolean(row.is_active),
  });
};

// =====================================================
// REPOSITORY FUNCTIONS
// =====================================================

export type PackageListItem = z.infer<typeof PackageListItemSchema>;
export type PackageComponentListItem = z.infer<typeof PackageComponentListItemSchema>;

type ListPackagesInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  packageType?: string;
  isActive?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  validOn?: string;
};

export const listPackages = async ({
  limit = 200,
  tenantId,
  propertyId,
  packageType,
  isActive,
  isPublished,
  isFeatured,
  validOn,
}: ListPackagesInput): Promise<PackageListItem[]> => {
  const result = await query<PackageRow>(PACKAGE_LIST_SQL, [
    limit,
    tenantId,
    propertyId ?? null,
    packageType ?? null,
    isActive ?? null,
    isPublished ?? null,
    isFeatured ?? null,
    validOn ?? null,
  ]);

  return result.rows.map(mapPackageRow);
};

type GetPackageInput = {
  packageId: string;
  tenantId: string;
};

export const getPackageById = async ({
  packageId,
  tenantId,
}: GetPackageInput): Promise<PackageListItem | null> => {
  const result = await query<PackageRow>(PACKAGE_BY_ID_SQL, [packageId, tenantId]);

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapPackageRow(row);
};

type GetPackageComponentsInput = {
  packageId: string;
};

export const getPackageComponents = async ({
  packageId,
}: GetPackageComponentsInput): Promise<PackageComponentListItem[]> => {
  const result = await query<PackageComponentRow>(PACKAGE_COMPONENTS_SQL, [packageId]);

  return result.rows.map(mapPackageComponentRow);
};

// =====================================================
// CREATE PACKAGE
// =====================================================

const CREATE_PACKAGE_SQL = `
  INSERT INTO public.packages (
    package_id, tenant_id, property_id,
    package_name, package_code, package_type, short_description,
    valid_from, valid_to,
    min_nights, max_nights, min_guests, max_guests,
    pricing_model, base_price,
    includes_breakfast, includes_lunch, includes_dinner,
    includes_parking, includes_wifi, includes_airport_transfer,
    refundable, free_cancellation_days,
    total_inventory,
    is_active, is_published, is_featured,
    display_order,
    created_by
  ) VALUES (
    gen_random_uuid(), $1, $2,
    $3, $4, $5, $6,
    $7, $8,
    $9, $10, $11, $12,
    $13, $14,
    $15, $16, $17,
    $18, $19, $20,
    $21, $22,
    $23,
    false, false, false,
    0,
    $24
  )
  RETURNING package_id
`;

export type CreatePackageInput = {
  tenantId: string;
  propertyId?: string;
  packageName: string;
  packageCode: string;
  packageType: string;
  shortDescription?: string;
  validFrom: string;
  validTo: string;
  minNights: number;
  maxNights?: number;
  minGuests: number;
  maxGuests?: number;
  pricingModel: string;
  basePrice: number;
  includesBreakfast: boolean;
  includesLunch: boolean;
  includesDinner: boolean;
  includesParking: boolean;
  includesWifi: boolean;
  includesAirportTransfer: boolean;
  refundable: boolean;
  freeCancellationDays?: number;
  totalInventory?: number;
  createdBy?: string;
};

export const createPackage = async (input: CreatePackageInput): Promise<string> => {
  const result = await query<{ package_id: string }>(CREATE_PACKAGE_SQL, [
    input.tenantId,
    input.propertyId ?? null,
    input.packageName,
    input.packageCode,
    input.packageType.toLowerCase(),
    input.shortDescription ?? null,
    input.validFrom,
    input.validTo,
    input.minNights,
    input.maxNights ?? null,
    input.minGuests,
    input.maxGuests ?? null,
    input.pricingModel.toLowerCase(),
    input.basePrice,
    input.includesBreakfast,
    input.includesLunch,
    input.includesDinner,
    input.includesParking,
    input.includesWifi,
    input.includesAirportTransfer,
    input.refundable,
    input.freeCancellationDays ?? null,
    input.totalInventory ?? null,
    input.createdBy ?? null,
  ]);

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create package — no row returned");
  }
  return row.package_id;
};

// =====================================================
// UPDATE PACKAGE
// =====================================================

const UPDATE_PACKAGE_SQL = `
  UPDATE public.packages
  SET
    is_active = COALESCE($3, is_active),
    includes_breakfast = COALESCE($4, includes_breakfast),
    includes_lunch = COALESCE($5, includes_lunch),
    includes_dinner = COALESCE($6, includes_dinner),
    includes_parking = COALESCE($7, includes_parking),
    includes_wifi = COALESCE($8, includes_wifi),
    includes_airport_transfer = COALESCE($9, includes_airport_transfer),
    version = version + 1,
    updated_at = NOW(),
    updated_by = $10
  WHERE package_id = $1
    AND tenant_id = $2
    AND COALESCE(is_deleted, false) = false
  RETURNING package_id
`;

export type UpdatePackageInput = {
	packageId: string;
	tenantId: string;
	isActive?: boolean;
	includesBreakfast?: boolean;
	includesLunch?: boolean;
	includesDinner?: boolean;
	includesParking?: boolean;
	includesWifi?: boolean;
	includesAirportTransfer?: boolean;
	updatedBy?: string;
};

export const updatePackage = async (input: UpdatePackageInput): Promise<string | null> => {
	const result = await query<{ package_id: string }>(UPDATE_PACKAGE_SQL, [
		input.packageId,
		input.tenantId,
		input.isActive ?? null,
		input.includesBreakfast ?? null,
		input.includesLunch ?? null,
		input.includesDinner ?? null,
		input.includesParking ?? null,
		input.includesWifi ?? null,
		input.includesAirportTransfer ?? null,
		input.updatedBy ?? null,
	]);

	return result.rows[0]?.package_id ?? null;
};

// =====================================================
// CREATE PACKAGE COMPONENT
// =====================================================

const CREATE_PACKAGE_COMPONENT_SQL = `
  INSERT INTO public.package_components (
    package_id,
    component_type,
    component_name,
    component_description,
    quantity,
    pricing_type,
    unit_price,
    is_included,
    is_optional,
    is_mandatory,
    delivery_timing,
    delivery_location,
    display_order,
    is_active,
    created_by
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14
  )
  RETURNING component_id
`;

export type CreatePackageComponentInput = {
	packageId: string;
	componentType: string;
	componentName: string;
	componentDescription?: string;
	quantity: number;
	pricingType: string;
	unitPrice: number;
	isIncluded: boolean;
	isOptional: boolean;
	isMandatory: boolean;
	deliveryTiming?: string;
	deliveryLocation?: string;
	displayOrder: number;
	createdBy?: string;
};

export const createPackageComponent = async (
	input: CreatePackageComponentInput,
): Promise<string> => {
	const result = await query<{ component_id: string }>(CREATE_PACKAGE_COMPONENT_SQL, [
		input.packageId,
		input.componentType,
		input.componentName,
		input.componentDescription ?? null,
		input.quantity,
		input.pricingType,
		input.unitPrice,
		input.isIncluded,
		input.isOptional,
		input.isMandatory,
		input.deliveryTiming ?? null,
		input.deliveryLocation ?? null,
		input.displayOrder,
		input.createdBy ?? null,
	]);

	const row = result.rows[0];
	if (!row) {
		throw new Error("Failed to create component — no row returned");
	}
	return row.component_id;
};
