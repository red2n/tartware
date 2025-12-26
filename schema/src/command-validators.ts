import {
	BillingPaymentCaptureCommandSchema,
	BillingPaymentRefundCommandSchema,
} from "./events/commands/billing.js";
import {
	GuestMergeCommandSchema,
	GuestRegisterCommandSchema,
} from "./events/commands/guests.js";
import {
	HousekeepingAssignCommandSchema,
	HousekeepingCompleteCommandSchema,
} from "./events/commands/housekeeping.js";
import {
	InventoryBulkReleaseCommandSchema,
	InventoryLockRoomCommandSchema,
	InventoryReleaseRoomCommandSchema,
} from "./events/commands/inventory.js";
import {
	ReservationCancelCommandSchema,
	ReservationCreateCommandSchema,
	ReservationModifyCommandSchema,
} from "./events/commands/reservations.js";
import { RoomInventoryBlockCommandSchema } from "./events/commands/rooms.js";

type CommandPayloadValidator = (
	payload: Record<string, unknown>,
) => Record<string, unknown>;

const commandPayloadValidators = new Map<string, CommandPayloadValidator>([
	[
		"billing.payment.capture",
		(payload) => BillingPaymentCaptureCommandSchema.parse(payload),
	],
	[
		"billing.payment.refund",
		(payload) => BillingPaymentRefundCommandSchema.parse(payload),
	],
	["guest.register", (payload) => GuestRegisterCommandSchema.parse(payload)],
	["guest.merge", (payload) => GuestMergeCommandSchema.parse(payload)],
	[
		"housekeeping.task.assign",
		(payload) => HousekeepingAssignCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.complete",
		(payload) => HousekeepingCompleteCommandSchema.parse(payload),
	],
	[
		"inventory.lock.room",
		(payload) => InventoryLockRoomCommandSchema.parse(payload),
	],
	[
		"inventory.release.room",
		(payload) => InventoryReleaseRoomCommandSchema.parse(payload),
	],
	[
		"inventory.release.bulk",
		(payload) => InventoryBulkReleaseCommandSchema.parse(payload),
	],
	[
		"reservation.create",
		(payload) => ReservationCreateCommandSchema.parse(payload),
	],
	[
		"reservation.modify",
		(payload) => ReservationModifyCommandSchema.parse(payload),
	],
	[
		"reservation.cancel",
		(payload) => ReservationCancelCommandSchema.parse(payload),
	],
	[
		"rooms.inventory.block",
		(payload) => RoomInventoryBlockCommandSchema.parse(payload),
	],
]);

export const validateCommandPayload = (
	commandName: string,
	payload: Record<string, unknown>,
): Record<string, unknown> => {
	const validator = commandPayloadValidators.get(commandName);
	return validator ? validator(payload) : payload;
};
