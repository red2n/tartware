/**
 * Event billing — UI item 6 of ui-gaps/13-sales-catering.md.
 *
 * Sales & catering ends here: an event is booked (core-service), a BEO is
 * produced, and the money it earned has to land somewhere. Per the §2 decision
 * in that spec, "somewhere" is the event's own folio — `event_bookings.folio_id`
 * — which is a MASTER folio carrying no reservation.
 *
 * These are commands rather than HTTP routes on core-service because the write
 * crosses services: the booking is core-service's, the folio and its postings
 * are billing-service's. That is COV-18's discriminator, and it is why this file
 * reads and writes `event_bookings` the way `group-billing.ts` reads and writes
 * `group_bookings`.
 */

import {
  deriveEventChargeQuote,
  EVENT_CHARGE_CODES,
  type EventChargeQuote,
} from "@tartware/schemas";

import { auditAsync } from "../../lib/audit-logger.js";
import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingEventPostChargesCommandSchema,
  BillingEventSetupCommandSchema,
} from "../../schemas/billing-commands.js";

import { postCharge } from "./charge.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * The event fields billing needs: enough to price the booking, plus the state
 * that decides whether it may be billed at all.
 *
 * `pg` returns every DECIMAL as a string, which is exactly what
 * `deriveEventChargeQuote` accepts — no float ever touches these amounts.
 */
type EventBillingRow = {
  event_id: string;
  property_id: string;
  event_number: string | null;
  event_name: string;
  event_date: string;
  booking_status: string;
  organizer_name: string;
  organizer_company: string | null;
  group_booking_id: string | null;
  folio_id: string | null;
  charges_posted_at: Date | null;
  rental_rate: string | null;
  setup_fee: string | null;
  equipment_rental_fee: string | null;
  av_equipment_fee: string | null;
  labor_charges: string | null;
  estimated_food_beverage: string | null;
  service_charge_percent: string | null;
  tax_rate: string | null;
  discount_amount: string | null;
  tax_exempt: boolean | null;
  currency_code: string | null;
};

const EVENT_BILLING_ROW_SQL = `
  SELECT event_id, property_id, event_number, event_name, event_date, booking_status,
         organizer_name, organizer_company, group_booking_id, folio_id, charges_posted_at,
         rental_rate, setup_fee, equipment_rental_fee, av_equipment_fee, labor_charges,
         estimated_food_beverage, service_charge_percent, tax_rate, discount_amount,
         tax_exempt, currency_code
    FROM public.event_bookings
   WHERE event_id = $1::uuid
     AND tenant_id = $2::uuid
     AND COALESCE(is_deleted, false) = false
`;

/** A cancelled or no-show event has nothing to bill through this path. */
const BILLABLE_STATUSES = new Set([
  "INQUIRY",
  "TENTATIVE",
  "DEFINITE",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
]);

const loadEvent = async (tenantId: string, eventId: string): Promise<EventBillingRow> => {
  const { rows } = await query<EventBillingRow>(EVENT_BILLING_ROW_SQL, [eventId, tenantId]);
  const event = rows[0];
  if (!event) {
    throw new BillingCommandError("EVENT_NOT_FOUND", `Event booking ${eventId} not found.`);
  }
  return event;
};

/**
 * Deterministic folio number for an event, mirroring `MASTER-<id8>` on group
 * folios. It is what makes opening the folio idempotent: a second dispatch
 * collides with the row the first one wrote and adopts it.
 */
const eventFolioNumber = (eventId: string): string => `EVT-${eventId.slice(0, 8).toUpperCase()}`;

/**
 * Opens the event's folio if it has none, and links it back to the booking.
 *
 * Returns the folio id either way, so callers can treat "already had one" and
 * "just opened one" alike.
 *
 * The link is written from here rather than from core-service because the folio
 * id does not exist until this insert runs, and a command reply cannot carry it
 * back: dispatch is asynchronous and answers 202. `express-checkout.ts` and
 * `night-audit.ts` write `reservations` from this service for the same reason.
 */
const resolveOrOpenEventFolio = async (
  event: EventBillingRow,
  context: CommandContext,
  actorId: string,
  notes?: string,
): Promise<{ folioId: string; opened: boolean }> => {
  if (event.folio_id) {
    return { folioId: event.folio_id, opened: false };
  }

  const folioNumber = eventFolioNumber(event.event_id);
  const currency = (event.currency_code ?? "USD").toUpperCase();

  const inserted = await query<{ folio_id: string }>(
    `INSERT INTO public.folios (
       tenant_id, property_id, folio_number, folio_type, folio_status,
       guest_name, company_name, currency_code, group_booking_id,
       reference_number, notes, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, 'MASTER', 'OPEN',
       $4, $5, UPPER($6), $7::uuid,
       $8, $9, $10::uuid, $10::uuid
     )
     ON CONFLICT (tenant_id, property_id, folio_number) DO NOTHING
     RETURNING folio_id`,
    [
      context.tenantId,
      event.property_id,
      folioNumber,
      event.organizer_name,
      event.organizer_company,
      currency,
      event.group_booking_id,
      event.event_number,
      notes ?? `Event folio for ${event.event_name} on ${String(event.event_date).slice(0, 10)}`,
      actorId,
    ],
  );

  let folioId = inserted.rows[0]?.folio_id ?? null;
  let opened = Boolean(folioId);

  // The insert was a no-op: a folio with this number already exists, because an
  // earlier dispatch opened it and its link write did not reach the booking.
  // Adopt it rather than opening a second folio for one event.
  if (!folioId) {
    const { rows } = await query<{ folio_id: string }>(
      `SELECT folio_id FROM public.folios
        WHERE tenant_id = $1::uuid AND property_id = $2::uuid AND folio_number = $3`,
      [context.tenantId, event.property_id, folioNumber],
    );
    folioId = rows[0]?.folio_id ?? null;
    opened = false;
  }

  if (!folioId) {
    throw new BillingCommandError(
      "EVENT_FOLIO_FAILED",
      `Could not open a folio for event ${event.event_id}.`,
      true,
    );
  }

  // Only claim the booking if it is still unlinked — a concurrent dispatch that
  // won the race keeps its folio, and this one reports that folio rather than
  // overwriting the link.
  const { rows: linked } = await query<{ folio_id: string }>(
    `UPDATE public.event_bookings
        SET folio_id = $3::uuid, updated_at = NOW(), updated_by = $4::uuid
      WHERE event_id = $1::uuid AND tenant_id = $2::uuid AND folio_id IS NULL
      RETURNING folio_id`,
    [event.event_id, context.tenantId, folioId, actorId],
  );

  if (linked.length === 0) {
    const { rows } = await query<{ folio_id: string | null }>(
      `SELECT folio_id FROM public.event_bookings
        WHERE event_id = $1::uuid AND tenant_id = $2::uuid`,
      [event.event_id, context.tenantId],
    );
    const existing = rows[0]?.folio_id;
    if (existing && existing !== folioId) {
      return { folioId: existing, opened: false };
    }
  }

  return { folioId, opened };
};

/**
 * Open the event's own folio — `billing.event.setup`.
 *
 * Idempotent: dispatching it against an event that already has a folio returns
 * that folio and changes nothing, so the screen's "open folio" action is safe to
 * retry.
 */
export const setupEventBilling = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingEventSetupCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const event = await loadEvent(context.tenantId, command.event_id);

  if (!BILLABLE_STATUSES.has(event.booking_status)) {
    throw new BillingCommandError(
      "EVENT_NOT_BILLABLE",
      `Event ${event.event_id} is ${event.booking_status} and cannot be billed.`,
    );
  }

  const { folioId, opened } = await resolveOrOpenEventFolio(event, context, actorId, command.notes);

  if (opened) {
    appLogger.info(
      { eventId: event.event_id, folioId, folioNumber: eventFolioNumber(event.event_id) },
      "Event folio opened",
    );
    auditAsync({
      tenantId: context.tenantId,
      propertyId: event.property_id,
      userId: actorId,
      action: "EVENT_FOLIO_OPEN",
      entityType: "event_booking",
      entityId: event.event_id,
      severity: "INFO",
      description: `Folio ${eventFolioNumber(event.event_id)} opened for event ${event.event_name}`,
      newValues: { event_id: event.event_id, folio_id: folioId },
    });
  }

  return folioId;
};

/**
 * Post the event's charges to its folio — `billing.event.post_charges`.
 *
 * The amounts come from `deriveEventChargeQuote`, which reads the booking's own
 * money columns; the payload carries none, so there is no total an operator can
 * post that the booking does not say. The same function backs the preview on the
 * event screen, so what was approved is what lands.
 *
 * **Posts once.** `charges_posted_at` is claimed with a conditional UPDATE
 * before the first line is posted, which is what makes a double dispatch a 409
 * rather than a doubled folio balance. The claim is deliberately taken *first*:
 * of the two ways this can fail, a short folio the operator can top up from the
 * billing screen is recoverable, and a silently doubled banquet bill is not.
 * Later additions — consumption over the estimate, an extra AV hire — are
 * ordinary charges on the folio.
 *
 * Each line goes through `billing.charge.post`'s own handler rather than
 * inserting into `charge_postings` here, so event revenue picks up FX locking,
 * GL pairing and folio routing exactly as every other charge does.
 */
export const postEventCharges = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingEventPostChargesCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const event = await loadEvent(context.tenantId, command.event_id);

  if (!BILLABLE_STATUSES.has(event.booking_status)) {
    throw new BillingCommandError(
      "EVENT_NOT_BILLABLE",
      `Event ${event.event_id} is ${event.booking_status} and cannot be billed.`,
    );
  }

  if (event.charges_posted_at) {
    throw new BillingCommandError(
      "EVENT_CHARGES_ALREADY_POSTED",
      `Event ${event.event_id} was billed on ${event.charges_posted_at.toISOString()}. Post further charges to its folio directly.`,
    );
  }

  const quote: EventChargeQuote = deriveEventChargeQuote(event);
  if (quote.lines.length === 0) {
    throw new BillingCommandError(
      "EVENT_NOTHING_TO_BILL",
      `Event ${event.event_id} has no priced items — set a rental rate, catering or fees before posting.`,
    );
  }

  const { folioId } = await resolveOrOpenEventFolio(event, context, actorId, command.notes);

  // Claim the guard before any money moves. A dispatch that loses this race
  // reads zero rows and stops here, having posted nothing.
  const { rows: claimed } = await query<{ event_id: string }>(
    `UPDATE public.event_bookings
        SET charges_posted_at = NOW(),
            charges_posted_by = $3::uuid,
            actual_total = $4,
            updated_at = NOW(),
            updated_by = $3::uuid
      WHERE event_id = $1::uuid AND tenant_id = $2::uuid AND charges_posted_at IS NULL
      RETURNING event_id`,
    [event.event_id, context.tenantId, actorId, quote.total],
  );

  if (claimed.length === 0) {
    throw new BillingCommandError(
      "EVENT_CHARGES_ALREADY_POSTED",
      `Event ${event.event_id} is already being billed by another request.`,
    );
  }

  const eventLabel = event.event_number ?? event.event_name;
  const postedIds: string[] = [];

  for (const line of quote.lines) {
    const postingId = await postCharge(
      {
        property_id: event.property_id,
        folio_id: folioId,
        amount: line.amount,
        currency: quote.currency_code,
        charge_code: line.charge_code,
        department_code: line.department_code,
        posting_type: line.posting_type,
        quantity: 1,
        description: `${line.description} — ${eventLabel}`,
        posted_at: command.posted_at,
        metadata: {
          source: "event_booking",
          event_id: event.event_id,
          event_name: event.event_name,
        },
        idempotency_key: `event-charges:${event.event_id}:${line.charge_code}`,
      },
      context,
    );
    postedIds.push(postingId);
  }

  appLogger.info(
    {
      eventId: event.event_id,
      folioId,
      lineCount: quote.lines.length,
      total: quote.total,
      currency: quote.currency_code,
    },
    "Event charges posted to folio",
  );

  auditAsync({
    tenantId: context.tenantId,
    propertyId: event.property_id,
    userId: actorId,
    action: "EVENT_CHARGES_POST",
    entityType: "event_booking",
    entityId: event.event_id,
    severity: "INFO",
    description: `${quote.lines.length} charge(s) totalling ${quote.total} ${quote.currency_code} posted to folio for event ${event.event_name}`,
    newValues: {
      event_id: event.event_id,
      folio_id: folioId,
      total: quote.total,
      currency: quote.currency_code,
      charge_codes: quote.lines.map((line) => line.charge_code),
      tax_charge_code: EVENT_CHARGE_CODES.tax,
      posting_ids: postedIds,
    },
  });

  return folioId;
};
