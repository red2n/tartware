/**
 * DEV DOC
 * Module: lost-and-found-repository.ts
 * Purpose: The lost-property register: logging found items, claims and returns.
 * Ownership: housekeeping-service
 *
 * Lifted verbatim out of `services/lost-and-found-service.ts`. The partial
 * update stays in the service: it builds its SET clause from whichever fields
 * were supplied, so the statement is assembled, not stored.
 */

import { query } from "../lib/db.js";

const FIND_LOST_AND_FOUND_ITEM_SQL = `SELECT
       item_id, tenant_id, property_id, item_number,
       item_name, item_description, item_category, item_subcategory,
       brand, model, color, size, distinguishing_features, serial_number,
       estimated_value, currency, is_valuable, is_perishable,
       found_date::text, found_time::text, found_by, found_by_name,
       found_location, room_number, room_id, floor_number, area_name, specific_location,
       guest_id, guest_name, guest_email, guest_phone, reservation_id, checkout_date::text,
       item_status,
       storage_location, storage_shelf, storage_bin, storage_date::text, stored_by,
       requires_secure_storage, secure_storage_location, is_locked, access_log,
       has_photos, photo_urls, photo_count,
       has_documents, document_urls,
       claim_count, claimed, claimed_by_guest_id, claimed_by_name, claim_date::text,
       hold_until_date::text, days_in_storage,
       returned, return_date::text, return_method,
       internal_notes,
       created_at, updated_at
     FROM lost_and_found
     WHERE item_id = $1 AND tenant_id = $2 AND is_deleted = false`;

const INSERT_LOST_AND_FOUND_ITEM_SQL = `INSERT INTO lost_and_found (
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
     RETURNING item_id`;

const MARK_ITEM_CLAIMED_SQL = `UPDATE lost_and_found
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
     RETURNING *`;

const MARK_ITEM_RETURNED_SQL = `UPDATE lost_and_found
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
     RETURNING *`;

/**
 * One lost-property item.
 */
export const findLostAndFoundItem = (itemId: string, tenantId: string) =>
  query(FIND_LOST_AND_FOUND_ITEM_SQL, [itemId, tenantId]);

/**
 * Log a found item.
 */
export const insertLostAndFoundItem = (
  params: {
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
  },
  holdDays: number,
) =>
  query<{ item_id: string }>(INSERT_LOST_AND_FOUND_ITEM_SQL, [
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
  ]);

/**
 * Record a guest claiming an item.
 */
export const markItemClaimed = (params: {
  itemId: string;
  tenantId: string;
  claimedByGuestId?: string;
  claimedByName: string;
  verificationNotes?: string;
  verifiedBy?: string;
}) =>
  query(MARK_ITEM_CLAIMED_SQL, [
    params.itemId,
    params.tenantId,
    params.claimedByGuestId ?? null,
    params.claimedByName,
    params.verificationNotes ?? null,
    params.verifiedBy ?? null,
  ]);

/**
 * Record an item being handed back or shipped.
 */
export const markItemReturned = (params: {
  itemId: string;
  tenantId: string;
  returnMethod: string;
  returnedToName: string;
  returnedBy?: string;
  notes?: string;
}) =>
  query(MARK_ITEM_RETURNED_SQL, [
    params.itemId,
    params.tenantId,
    params.returnMethod,
    params.returnedToName,
    params.returnedBy ?? null,
    params.notes ?? null,
  ]);
