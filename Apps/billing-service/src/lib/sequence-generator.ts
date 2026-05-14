import type { PoolClient } from "pg";

import { queryWithClient } from "../lib/db.js";

/**
 * Generate the next gap-free document number for an invoice or credit note.
 *
 * Uses an atomic `INSERT ... ON CONFLICT DO UPDATE` + RETURNING pattern to
 * guarantee that no two concurrent transactions can claim the same number.
 * Must be called inside an existing transaction (caller supplies the client).
 *
 * Returns a formatted number string:
 *   - INVOICE:     `INV-{PROPERTY_CODE}-{YYYY}-{NNNNN}`
 *   - CREDIT_NOTE: `CN-{PROPERTY_CODE}-{YYYY}-{NNNNN}`
 *
 * Example: `INV-HTL001-2025-00042`
 */
export async function nextDocumentNumber(
  client: PoolClient,
  tenantId: string,
  propertyId: string,
  documentType: "INVOICE" | "CREDIT_NOTE",
): Promise<string> {
  const year = new Date().getFullYear();

  // Atomically upsert the sequence row and increment last_number.
  // The `FOR UPDATE` is implicit because INSERT ... ON CONFLICT UPDATE
  // takes an exclusive row lock before writing.
  const seqResult = await queryWithClient<{ last_number: number }>(
    client,
    `INSERT INTO public.invoice_sequences (tenant_id, property_id, document_type, fiscal_year, last_number, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, 1, NOW())
     ON CONFLICT (tenant_id, property_id, document_type, fiscal_year)
     DO UPDATE SET last_number = invoice_sequences.last_number + 1,
                   updated_at  = NOW()
     RETURNING last_number`,
    [tenantId, propertyId, documentType, year],
  );

  const seq = seqResult.rows[0]?.last_number;
  if (!seq) {
    throw new Error(`Failed to generate sequence number for ${documentType}`);
  }

  // Fetch the property code for the formatted number (e.g. "HTL001")
  const propResult = await queryWithClient<{ property_code: string }>(
    client,
    `SELECT property_code FROM public.properties WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
    [propertyId, tenantId],
  );

  const propertyCode = propResult.rows[0]?.property_code ?? "PROP";
  const paddedSeq = String(seq).padStart(5, "0");
  const prefix = documentType === "INVOICE" ? "INV" : "CN";

  return `${prefix}-${propertyCode}-${year}-${paddedSeq}`;
}
