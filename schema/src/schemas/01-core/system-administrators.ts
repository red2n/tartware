/**
 * System Administrators Schema
 * @table system_administrators
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import {
	auditTimestamps,
	email,
	jsonbMetadata,
	nonEmptyString,
	uuid,
} from "../../shared/base-schemas.js";
import { SystemAdminRoleEnum } from "../../shared/enums.js";

const ipAddress = z.string().min(2).max(45).describe("IPv4/IPv6 or CIDR range");
const TimestampRangeString = z
	.string()
	.min(5)
	.describe("PostgreSQL tstzrange textual representation");

export const SystemAdministratorSchema = z.object({
	id: uuid,
	username: nonEmptyString.max(150),
	email,
	password_hash: z.string().min(20).describe("BCrypt hash"),
	role: SystemAdminRoleEnum,
	mfa_secret: z.string().min(16).optional(),
	mfa_enabled: z.boolean().default(false),
	ip_whitelist: z.array(ipAddress).default([]),
	allowed_hours: TimestampRangeString.optional(),
	last_login_at: z.coerce.date().optional(),
	failed_login_attempts: z.number().int().nonnegative().default(0),
	account_locked_until: z.coerce.date().optional(),
	is_active: z.boolean().default(true),
	created_by: uuid.optional(),
	metadata: jsonbMetadata,
	...auditTimestamps,
});

export type SystemAdministrator = z.infer<typeof SystemAdministratorSchema>;

export const PublicSystemAdministratorSchema = SystemAdministratorSchema.omit({
	password_hash: true,
	mfa_secret: true,
});

export type PublicSystemAdministrator = z.infer<
	typeof PublicSystemAdministratorSchema
>;
