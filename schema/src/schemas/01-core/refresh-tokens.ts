/**
 * DEV DOC
 * Module: schemas/01-core/refresh-tokens.ts
 * Description: Refresh Tokens Schema
 * Table: refresh_tokens
 * Category: 01-core
 * @table refresh_tokens
 * @category 01-core
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete refresh token schema (internal view)
 */
export const RefreshTokenSchema = z.object({
	id: uuid,
	user_id: uuid,
	token_hash: z.string().min(1),
	expires_at: z.coerce.date(),
	revoked_at: z.coerce.date().nullable().optional(),
	created_at: z.coerce.date(),
	created_by_ip: z.string().max(45).nullable().optional(),
	user_agent: z.string().nullable().optional(),
});

export type RefreshToken = z.infer<typeof RefreshTokenSchema>;

/**
 * Input for creating a new refresh token record
 */
export const CreateRefreshTokenSchema = RefreshTokenSchema.pick({
	user_id: true,
	token_hash: true,
	expires_at: true,
	created_by_ip: true,
	user_agent: true,
});

export type CreateRefreshToken = z.infer<typeof CreateRefreshTokenSchema>;
