/**
 * DEV DOC
 * Module: command-validators.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import {
	AnalyticsMetricIngestCommandSchema,
	AnalyticsReportScheduleCommandSchema,
} from "./events/commands/analytics.js";
import {
	ComplianceBreachReportCommandSchema,
	ComplianceBreachNotifyCommandSchema,
} from "./events/commands/compliance.js";
import {
	BillingPaymentCaptureCommandSchema,
	BillingPaymentRefundCommandSchema,
	BillingPaymentAuthorizeCommandSchema,
	BillingInvoiceAdjustCommandSchema,
	BillingInvoiceCreateCommandSchema,
	BillingChargePostCommandSchema,
	BillingPaymentApplyCommandSchema,
	BillingFolioTransferCommandSchema,
	BillingChargeTransferCommandSchema,
	BillingFolioSplitCommandSchema,
	BillingNightAuditCommandSchema,
	BillingFolioCloseCommandSchema,
	BillingPaymentVoidCommandSchema,
	BillingChargeVoidCommandSchema,
	BillingInvoiceFinalizeCommandSchema,
	CommissionCalculateCommandSchema,
	CommissionApproveCommandSchema,
	CommissionMarkPaidCommandSchema,
	CommissionStatementGenerateCommandSchema,
	BillingArPostCommandSchema,
	BillingArApplyPaymentCommandSchema,
	BillingArAgeCommandSchema,
	BillingArWriteOffCommandSchema,
	BillingCashierOpenCommandSchema,
	BillingCashierCloseCommandSchema,
	BillingPricingEvaluateCommandSchema,
	BillingPricingBulkRecommendCommandSchema,
} from "./events/commands/billing.js";
import {
	GroupCreateCommandSchema,
	GroupAddRoomsCommandSchema,
	GroupUploadRoomingListCommandSchema,
	GroupCutoffEnforceCommandSchema,
	GroupBillingSetupCommandSchema,
} from "./events/commands/groups.js";
import {
	GuestMergeCommandSchema,
	GuestRegisterCommandSchema,
	GuestUpdateContactCommandSchema,
	GuestUpdateProfileCommandSchema,
	GuestSetLoyaltyCommandSchema,
	GuestSetVipCommandSchema,
	GuestSetBlacklistCommandSchema,
	GuestGdprEraseCommandSchema,
	GuestPreferenceUpdateCommandSchema,
} from "./events/commands/guests.js";
import {
	HousekeepingAssignCommandSchema,
	HousekeepingCompleteCommandSchema,
	HousekeepingTaskAddNoteCommandSchema,
	HousekeepingTaskBulkStatusCommandSchema,
	HousekeepingTaskCreateCommandSchema,
	HousekeepingTaskReassignCommandSchema,
	HousekeepingTaskReopenCommandSchema,
} from "./events/commands/housekeeping.js";
import {
	IntegrationMappingUpdateCommandSchema,
	IntegrationOtaRatePushCommandSchema,
	IntegrationOtaSyncRequestCommandSchema,
	IntegrationWebhookRetryCommandSchema,
} from "./events/commands/integrations.js";
import {
	InventoryBulkReleaseCommandSchema,
	InventoryLockRoomCommandSchema,
	InventoryReleaseRoomCommandSchema,
} from "./events/commands/inventory.js";
import {
	LoyaltyPointsEarnCommandSchema,
	LoyaltyPointsRedeemCommandSchema,
} from "./events/commands/loyalty.js";
import {
	NotificationSendCommandSchema,
} from "./events/commands/notifications.js";
import {
	OperationsAssetUpdateCommandSchema,
	OperationsIncidentReportCommandSchema,
	OperationsInventoryAdjustCommandSchema,
	OperationsMaintenanceRequestCommandSchema,
	OperationsScheduleCreateCommandSchema,
	OperationsScheduleUpdateCommandSchema,
} from "./events/commands/operations.js";
import {
	ReservationCancelCommandSchema,
	ReservationCheckInCommandSchema,
	ReservationCheckOutCommandSchema,
	ReservationCreateCommandSchema,
	ReservationDepositAddCommandSchema,
	ReservationDepositReleaseCommandSchema,
	ReservationExtendStayCommandSchema,
	ReservationAssignRoomCommandSchema,
	ReservationBatchNoShowCommandSchema,
	ReservationModifyCommandSchema,
	ReservationRateOverrideCommandSchema,
	ReservationUnassignRoomCommandSchema,
	ReservationNoShowCommandSchema,
	ReservationWalkInCheckInCommandSchema,
	ReservationWaitlistAddCommandSchema,
	ReservationWaitlistConvertCommandSchema,
	ReservationWaitlistOfferCommandSchema,
	ReservationWaitlistExpireSweepCommandSchema,
	ReservationGenerateRegCardCommandSchema,
	ReservationMobileCheckinStartCommandSchema,
	ReservationMobileCheckinCompleteCommandSchema,
	ReservationSendQuoteCommandSchema,
	ReservationConvertQuoteCommandSchema,
	ReservationExpireCommandSchema,
	ReservationWalkGuestCommandSchema,
} from "./events/commands/reservations.js";
import {
	RoomFeaturesUpdateCommandSchema,
	RoomHousekeepingStatusUpdateCommandSchema,
	RoomInventoryBlockCommandSchema,
	RoomInventoryReleaseCommandSchema,
	RoomKeyIssueCommandSchema,
	RoomKeyRevokeCommandSchema,
	RoomMoveCommandSchema,
	RoomOutOfOrderCommandSchema,
	RoomOutOfServiceCommandSchema,
	RoomStatusUpdateCommandSchema,
} from "./events/commands/rooms.js";
import {
	SettingsValueApproveCommandSchema,
	SettingsValueBulkSetCommandSchema,
	SettingsValueRevertCommandSchema,
	SettingsValueSetCommandSchema,
} from "./events/commands/settings.js";

type CommandPayloadValidator = (
	payload: Record<string, unknown>,
) => Record<string, unknown>;

const commandPayloadValidators = new Map<string, CommandPayloadValidator>([
	[
		"analytics.metric.ingest",
		(payload) => AnalyticsMetricIngestCommandSchema.parse(payload),
	],
	[
		"analytics.report.schedule",
		(payload) => AnalyticsReportScheduleCommandSchema.parse(payload),
	],
	[
		"billing.payment.capture",
		(payload) => BillingPaymentCaptureCommandSchema.parse(payload),
	],
	[
		"billing.payment.refund",
		(payload) => BillingPaymentRefundCommandSchema.parse(payload),
	],
	[
		"billing.invoice.create",
		(payload) => BillingInvoiceCreateCommandSchema.parse(payload),
	],
	[
		"billing.invoice.adjust",
		(payload) => BillingInvoiceAdjustCommandSchema.parse(payload),
	],
	[
		"billing.charge.post",
		(payload) => BillingChargePostCommandSchema.parse(payload),
	],
	[
		"billing.payment.apply",
		(payload) => BillingPaymentApplyCommandSchema.parse(payload),
	],
	[
		"billing.folio.transfer",
		(payload) => BillingFolioTransferCommandSchema.parse(payload),
	],
	[
		"billing.charge.transfer",
		(payload) => BillingChargeTransferCommandSchema.parse(payload),
	],
	[
		"billing.folio.split",
		(payload) => BillingFolioSplitCommandSchema.parse(payload),
	],
	[
		"billing.payment.authorize",
		(payload) => BillingPaymentAuthorizeCommandSchema.parse(payload),
	],
	[
		"billing.night_audit.execute",
		(payload) => BillingNightAuditCommandSchema.parse(payload),
	],
	[
		"billing.folio.close",
		(payload) => BillingFolioCloseCommandSchema.parse(payload),
	],
	[
		"billing.payment.void",
		(payload) => BillingPaymentVoidCommandSchema.parse(payload),
	],
	[
		"billing.charge.void",
		(payload) => BillingChargeVoidCommandSchema.parse(payload),
	],
	[
		"billing.invoice.finalize",
		(payload) => BillingInvoiceFinalizeCommandSchema.parse(payload),
	],
	[
		"commission.calculate",
		(payload) => CommissionCalculateCommandSchema.parse(payload),
	],
	[
		"commission.approve",
		(payload) => CommissionApproveCommandSchema.parse(payload),
	],
	[
		"commission.mark_paid",
		(payload) => CommissionMarkPaidCommandSchema.parse(payload),
	],
	[
		"commission.statement.generate",
		(payload) => CommissionStatementGenerateCommandSchema.parse(payload),
	],
	[
		"billing.ar.post",
		(payload) => BillingArPostCommandSchema.parse(payload),
	],
	[
		"billing.ar.apply_payment",
		(payload) => BillingArApplyPaymentCommandSchema.parse(payload),
	],
	[
		"billing.ar.age",
		(payload) => BillingArAgeCommandSchema.parse(payload),
	],
	[
		"billing.ar.write_off",
		(payload) => BillingArWriteOffCommandSchema.parse(payload),
	],
	[
		"billing.cashier.open",
		(payload) => BillingCashierOpenCommandSchema.parse(payload),
	],
	[
		"billing.cashier.close",
		(payload) => BillingCashierCloseCommandSchema.parse(payload),
	],
	[
		"billing.pricing.evaluate",
		(payload) => BillingPricingEvaluateCommandSchema.parse(payload),
	],
	[
		"billing.pricing.bulk_recommend",
		(payload) => BillingPricingBulkRecommendCommandSchema.parse(payload),
	],
	["guest.register", (payload) => GuestRegisterCommandSchema.parse(payload)],
	["guest.merge", (payload) => GuestMergeCommandSchema.parse(payload)],
	[
		"guest.update_profile",
		(payload) => GuestUpdateProfileCommandSchema.parse(payload),
	],
	[
		"guest.update_contact",
		(payload) => GuestUpdateContactCommandSchema.parse(payload),
	],
	[
		"guest.set_loyalty",
		(payload) => GuestSetLoyaltyCommandSchema.parse(payload),
	],
	["guest.set_vip", (payload) => GuestSetVipCommandSchema.parse(payload)],
	[
		"guest.set_blacklist",
		(payload) => GuestSetBlacklistCommandSchema.parse(payload),
	],
	[
		"guest.gdpr.erase",
		(payload) => GuestGdprEraseCommandSchema.parse(payload),
	],
	[
		"guest.preference.update",
		(payload) => GuestPreferenceUpdateCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.assign",
		(payload) => HousekeepingAssignCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.complete",
		(payload) => HousekeepingCompleteCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.create",
		(payload) => HousekeepingTaskCreateCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.reassign",
		(payload) => HousekeepingTaskReassignCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.reopen",
		(payload) => HousekeepingTaskReopenCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.add_note",
		(payload) => HousekeepingTaskAddNoteCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.bulk_status",
		(payload) => HousekeepingTaskBulkStatusCommandSchema.parse(payload),
	],
	[
		"integration.ota.sync_request",
		(payload) => IntegrationOtaSyncRequestCommandSchema.parse(payload),
	],
	[
		"integration.ota.rate_push",
		(payload) => IntegrationOtaRatePushCommandSchema.parse(payload),
	],
	[
		"integration.webhook.retry",
		(payload) => IntegrationWebhookRetryCommandSchema.parse(payload),
	],
	[
		"integration.mapping.update",
		(payload) => IntegrationMappingUpdateCommandSchema.parse(payload),
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
		"operations.maintenance.request",
		(payload) => OperationsMaintenanceRequestCommandSchema.parse(payload),
	],
	[
		"operations.incident.report",
		(payload) => OperationsIncidentReportCommandSchema.parse(payload),
	],
	[
		"operations.asset.update",
		(payload) => OperationsAssetUpdateCommandSchema.parse(payload),
	],
	[
		"operations.inventory.adjust",
		(payload) => OperationsInventoryAdjustCommandSchema.parse(payload),
	],
	[
		"operations.schedule.create",
		(payload) => OperationsScheduleCreateCommandSchema.parse(payload),
	],
	[
		"operations.schedule.update",
		(payload) => OperationsScheduleUpdateCommandSchema.parse(payload),
	],
	[
		"compliance.breach.report",
		(payload) => ComplianceBreachReportCommandSchema.parse(payload),
	],
	[
		"compliance.breach.notify",
		(payload) => ComplianceBreachNotifyCommandSchema.parse(payload),
	],
	[
		"loyalty.points.earn",
		(payload) => LoyaltyPointsEarnCommandSchema.parse(payload),
	],
	[
		"loyalty.points.redeem",
		(payload) => LoyaltyPointsRedeemCommandSchema.parse(payload),
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
		"reservation.check_in",
		(payload) => ReservationCheckInCommandSchema.parse(payload),
	],
	[
		"reservation.check_out",
		(payload) => ReservationCheckOutCommandSchema.parse(payload),
	],
	[
		"reservation.assign_room",
		(payload) => ReservationAssignRoomCommandSchema.parse(payload),
	],
	[
		"reservation.unassign_room",
		(payload) => ReservationUnassignRoomCommandSchema.parse(payload),
	],
	[
		"reservation.extend_stay",
		(payload) => ReservationExtendStayCommandSchema.parse(payload),
	],
	[
		"reservation.rate_override",
		(payload) => ReservationRateOverrideCommandSchema.parse(payload),
	],
	[
		"reservation.add_deposit",
		(payload) => ReservationDepositAddCommandSchema.parse(payload),
	],
	[
		"reservation.release_deposit",
		(payload) => ReservationDepositReleaseCommandSchema.parse(payload),
	],
	[
		"reservation.no_show",
		(payload) => ReservationNoShowCommandSchema.parse(payload),
	],
	[
		"reservation.batch_no_show",
		(payload) => ReservationBatchNoShowCommandSchema.parse(payload),
	],
	[
		"reservation.walkin_checkin",
		(payload) => ReservationWalkInCheckInCommandSchema.parse(payload),
	],
	[
		"reservation.waitlist_add",
		(payload) => ReservationWaitlistAddCommandSchema.parse(payload),
	],
	[
		"reservation.waitlist_convert",
		(payload) => ReservationWaitlistConvertCommandSchema.parse(payload),
	],
	[
		"reservation.waitlist_offer",
		(payload) => ReservationWaitlistOfferCommandSchema.parse(payload),
	],
	[
		"reservation.waitlist_expire_sweep",
		(payload) => ReservationWaitlistExpireSweepCommandSchema.parse(payload),
	],
	[
		"reservation.generate_registration_card",
		(payload) => ReservationGenerateRegCardCommandSchema.parse(payload),
	],
	[
		"reservation.mobile_checkin.start",
		(payload) => ReservationMobileCheckinStartCommandSchema.parse(payload),
	],
	[
		"reservation.mobile_checkin.complete",
		(payload) => ReservationMobileCheckinCompleteCommandSchema.parse(payload),
	],
	[
		"reservation.send_quote",
		(payload) => ReservationSendQuoteCommandSchema.parse(payload),
	],
	[
		"reservation.convert_quote",
		(payload) => ReservationConvertQuoteCommandSchema.parse(payload),
	],
	[
		"reservation.expire",
		(payload) => ReservationExpireCommandSchema.parse(payload),
	],
	[
		"reservation.walk_guest",
		(payload) => ReservationWalkGuestCommandSchema.parse(payload),
	],
	[
		"group.create",
		(payload) => GroupCreateCommandSchema.parse(payload),
	],
	[
		"group.add_rooms",
		(payload) => GroupAddRoomsCommandSchema.parse(payload),
	],
	[
		"group.upload_rooming_list",
		(payload) => GroupUploadRoomingListCommandSchema.parse(payload),
	],
	[
		"group.cutoff_enforce",
		(payload) => GroupCutoffEnforceCommandSchema.parse(payload),
	],
	[
		"group.billing.setup",
		(payload) => GroupBillingSetupCommandSchema.parse(payload),
	],
	[
		"rooms.inventory.block",
		(payload) => RoomInventoryBlockCommandSchema.parse(payload),
	],
	[
		"rooms.inventory.release",
		(payload) => RoomInventoryReleaseCommandSchema.parse(payload),
	],
	[
		"rooms.status.update",
		(payload) => RoomStatusUpdateCommandSchema.parse(payload),
	],
	[
		"rooms.housekeeping_status.update",
		(payload) => RoomHousekeepingStatusUpdateCommandSchema.parse(payload),
	],
	[
		"rooms.out_of_order",
		(payload) => RoomOutOfOrderCommandSchema.parse(payload),
	],
	[
		"rooms.out_of_service",
		(payload) => RoomOutOfServiceCommandSchema.parse(payload),
	],
	["rooms.move", (payload) => RoomMoveCommandSchema.parse(payload)],
	[
		"rooms.features.update",
		(payload) => RoomFeaturesUpdateCommandSchema.parse(payload),
	],
	[
		"rooms.key.issue",
		(payload) => RoomKeyIssueCommandSchema.parse(payload),
	],
	[
		"rooms.key.revoke",
		(payload) => RoomKeyRevokeCommandSchema.parse(payload),
	],
	[
		"settings.value.set",
		(payload) => SettingsValueSetCommandSchema.parse(payload),
	],
	[
		"settings.value.bulk_set",
		(payload) => SettingsValueBulkSetCommandSchema.parse(payload),
	],
	[
		"settings.value.approve",
		(payload) => SettingsValueApproveCommandSchema.parse(payload),
	],
	[
		"settings.value.revert",
		(payload) => SettingsValueRevertCommandSchema.parse(payload),
	],
	[
		"notification.send",
		(payload) => NotificationSendCommandSchema.parse(payload),
	],
]);

export const validateCommandPayload = (
	commandName: string,
	payload: Record<string, unknown>,
): Record<string, unknown> => {
	const validator = commandPayloadValidators.get(commandName);
	return validator ? validator(payload) : payload;
};
