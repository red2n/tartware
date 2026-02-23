import { query } from "../lib/db.js";

/**
 * List lost & found items with filtering and pagination.
 */
export async function listLostAndFoundItems(params: {
  tenantId: string;
  propertyId?: string;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}): Promise<unknown[]> {
  const conditions: string[] = ["lf.tenant_id = $1", "lf.is_deleted = false"];
  const values: unknown[] = [params.tenantId];
  let idx = 2;

  if (params.propertyId) {
    conditions.push(`lf.property_id = $${idx++}`);
    values.push(params.propertyId);
  }
  if (params.status) {
    conditions.push(`lf.item_status = $${idx++}`);
    values.push(params.status);
  }
  if (params.category) {
    conditions.push(`lf.item_category = $${idx++}`);
    values.push(params.category);
  }
  if (params.dateFrom) {
    conditions.push(`lf.found_date >= $${idx++}::date`);
    values.push(params.dateFrom);
  }
  if (params.dateTo) {
    conditions.push(`lf.found_date <= $${idx++}::date`);
    values.push(params.dateTo);
  }

  values.push(params.limit, params.offset);

  const sql = `
    SELECT
      lf.item_id, lf.tenant_id, lf.property_id, lf.item_number,
      lf.item_name, lf.item_description, lf.item_category, lf.item_subcategory,
      lf.brand, lf.color, lf.estimated_value, lf.currency, lf.is_valuable,
      lf.found_date::text, lf.found_time::text, lf.found_by_name,
      lf.found_location, lf.room_number, lf.area_name,
      lf.guest_name, lf.guest_email, lf.reservation_id,
      lf.item_status, lf.storage_location, lf.storage_shelf, lf.storage_bin,
      lf.claimed, lf.claimed_by_name, lf.claim_date::text,
      lf.returned, lf.return_date::text, lf.return_method,
      lf.hold_until_date::text, lf.days_in_storage,
      lf.has_photos, lf.photo_count,
      lf.internal_notes,
      lf.created_at, lf.updated_at
    FROM lost_and_found lf
    WHERE ${conditions.join(" AND ")}
    ORDER BY lf.found_date DESC, lf.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;

  const result = await query(sql, values);
  return result.rows;
}

/**
 * Get a single lost & found item by ID.
 */
export async function getLostAndFoundItem(params: {
  itemId: string;
  tenantId: string;
}): Promise<unknown | null> {
  const result = await query(
    `SELECT * FROM lost_and_found
     WHERE item_id = $1 AND tenant_id = $2 AND is_deleted = false`,
    [params.itemId, params.tenantId],
  );
  return result.rows[0] ?? null;
}

/**
 * Register a new lost & found item.
 */
export async function createLostAndFoundItem(params: {
  tenantId: string;
  propertyId: string;
  itemName: string;
  itemDescription: string;
  itemCategory: string;
  itemSubcategory?: string;
  brand?: string;
  color?: string;
  estimatedValue?: number;
  foundDate: string;
  foundTime?: string;
  foundByName?: string;
  foundLocation: string;
  roomNumber?: string;
  areaName?: string;
  guestId?: string;
  guestName?: string;
  guestEmail?: string;
  reservationId?: string;
  storageLocation?: string;
  holdDays?: number;
  isValuable?: boolean;
  requiresSecureStorage?: boolean;
  specialHandlingInstructions?: string;
  internalNotes?: string;
  createdBy?: string;
}): Promise<{ item_id: string }> {
  const holdDays = params.holdDays ?? 90;

  const result = await query<{ item_id: string }>(
    `INSERT INTO lost_and_found (
       tenant_id, property_id, item_name, item_description, item_category,
       item_subcategory, brand, color, estimated_value,
       found_date, found_time, found_by_name, found_location,
       room_number, area_name, guest_id, guest_name, guest_email, reservation_id,
       storage_location, hold_until_date, is_valuable, requires_secure_storage,
       special_handling_instructions, internal_notes, created_by,
       item_status
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10::date, $11, $12, $13,
       $14, $15, $16, $17, $18, $19,
       $20, $10::date + $21 * interval '1 day', $22, $23,
       $24, $25, $26,
       'registered'
     )
     RETURNING item_id`,
    [
      params.tenantId,
      params.propertyId,
      params.itemName,
      params.itemDescription,
      params.itemCategory,
      params.itemSubcategory ?? null,
      params.brand ?? null,
      params.color ?? null,
      params.estimatedValue ?? null,
      params.foundDate,
      params.foundTime ?? null,
      params.foundByName ?? null,
      params.foundLocation,
      params.roomNumber ?? null,
      params.areaName ?? null,
      params.guestId ?? null,
      params.guestName ?? null,
      params.guestEmail ?? null,
      params.reservationId ?? null,
      params.storageLocation ?? null,
      holdDays,
      params.isValuable ?? false,
      params.requiresSecureStorage ?? false,
      params.specialHandlingInstructions ?? null,
      params.internalNotes ?? null,
      params.createdBy ?? null,
    ],
  );

  return result.rows[0]!;
}

/**
 * Update a lost & found item.
 */
export async function updateLostAndFoundItem(params: {
  itemId: string;
  tenantId: string;
  updates: Record<string, unknown>;
  updatedBy?: string;
}): Promise<unknown | null> {
  const allowedFields = [
    "item_name",
    "item_description",
    "item_category",
    "item_subcategory",
    "brand",
    "color",
    "estimated_value",
    "storage_location",
    "storage_shelf",
    "storage_bin",
    "item_status",
    "internal_notes",
    "staff_comments",
    "guest_name",
    "guest_email",
    "guest_phone",
    "guest_id",
    "reservation_id",
    "hold_until_date",
    "requires_secure_storage",
    "special_handling_instructions",
    "is_valuable",
    "fragile",
    "hazardous_material",
  ];

  const setClauses: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const values: unknown[] = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (field in params.updates) {
      setClauses.push(`${field} = $${idx++}`);
      values.push(params.updates[field]);
    }
  }

  if (params.updatedBy) {
    setClauses.push(`updated_by = $${idx++}`);
    values.push(params.updatedBy);
  }

  if (setClauses.length === 1) {
    return getLostAndFoundItem({ itemId: params.itemId, tenantId: params.tenantId });
  }

  values.push(params.itemId, params.tenantId);

  const result = await query(
    `UPDATE lost_and_found
     SET ${setClauses.join(", ")}
     WHERE item_id = $${idx++} AND tenant_id = $${idx++} AND is_deleted = false
     RETURNING *`,
    values,
  );

  return result.rows[0] ?? null;
}

/**
 * Record a claim attempt and update status.
 */
export async function claimLostAndFoundItem(params: {
  itemId: string;
  tenantId: string;
  claimedByGuestId?: string;
  claimedByName: string;
  verificationNotes?: string;
  verifiedBy?: string;
}): Promise<unknown | null> {
  const result = await query(
    `UPDATE lost_and_found
     SET claimed = true,
         claimed_by_guest_id = $3,
         claimed_by_name = $4,
         claim_date = CURRENT_DATE,
         claim_time = CURRENT_TIME,
         claim_count = claim_count + 1,
         item_status = 'claimed',
         verification_notes = $5,
         verified_by = $6,
         updated_at = CURRENT_TIMESTAMP
     WHERE item_id = $1 AND tenant_id = $2 AND is_deleted = false
     RETURNING *`,
    [
      params.itemId,
      params.tenantId,
      params.claimedByGuestId ?? null,
      params.claimedByName,
      params.verificationNotes ?? null,
      params.verifiedBy ?? null,
    ],
  );

  return result.rows[0] ?? null;
}

/**
 * Record item return.
 */
export async function returnLostAndFoundItem(params: {
  itemId: string;
  tenantId: string;
  returnMethod: string;
  returnedToName: string;
  returnedBy?: string;
  notes?: string;
}): Promise<unknown | null> {
  const result = await query(
    `UPDATE lost_and_found
     SET returned = true,
         return_date = CURRENT_DATE,
         return_time = CURRENT_TIME,
         return_method = $3,
         returned_to_name = $4,
         returned_by = $5,
         item_status = 'returned',
         internal_notes = COALESCE(internal_notes || E'\\n', '') || COALESCE($6, ''),
         updated_at = CURRENT_TIMESTAMP
     WHERE item_id = $1 AND tenant_id = $2 AND is_deleted = false
       AND item_status IN ('claimed', 'registered', 'stored', 'pending_claim')
     RETURNING *`,
    [
      params.itemId,
      params.tenantId,
      params.returnMethod,
      params.returnedToName,
      params.returnedBy ?? null,
      params.notes ?? null,
    ],
  );

  return result.rows[0] ?? null;
}
