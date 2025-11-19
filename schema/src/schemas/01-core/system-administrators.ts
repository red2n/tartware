/**
 * System Administrators Schema
 * @table system_administrators
 * @category 01-core
 * @synchronized 2025-11-19 (generated via `npm run generate -- 01-core system_administrators`)
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

const SystemAdministratorsBaseSchema = z.object({
	id: uuid,
	username: nonEmptyString.max(150),
	email,
	password_hash: z.string().min(20),
	role: SystemAdminRoleEnum,
	mfa_secret: z.string().min(16).optional(),
	mfa_enabled: z.boolean().default(false),
	ip_whitelist: z.array(z.string()).default([]),
	allowed_hours: z.string().optional(),
	last_login_at: z.coerce.date().optional(),
	failed_login_attempts: z.number().int().nonnegative().default(0),
	account_locked_until: z.coerce.date().optional(),
	is_active: z.boolean().default(true),
	metadata: jsonbMetadata,
	...auditTimestamps,
});

export const SystemAdministratorSchema = SystemAdministratorsBaseSchema;
export type SystemAdministrator = z.infer<typeof SystemAdministratorSchema>;

export const PublicSystemAdministratorSchema = SystemAdministratorSchema.omit({
	password_hash: true,
	mfa_secret: true,
});
export type PublicSystemAdministrator = z.infer<
	typeof PublicSystemAdministratorSchema
>;

export const CreateSystemAdministratorSchema = SystemAdministratorSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
});
export type CreateSystemAdministrator = z.infer<
	typeof CreateSystemAdministratorSchema
>;

export const UpdateSystemAdministratorSchema = SystemAdministratorSchema.partial().extend({
	id: uuid,
});
export type UpdateSystemAdministrator = z.infer<
	typeof UpdateSystemAdministratorSchema
>;
