/**
 * DEV DOC
 * Module: schemas/01-core/announcements.ts
 * Description: Announcements Schema - Staff and guest-facing notices
 * Table: announcements
 * Category: 01-core
 * Primary exports: AnnouncementsSchema, CreateAnnouncementsSchema, UpdateAnnouncementsSchema
 * @table announcements
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Announcements Schema
 * Internal staff announcements and guest-facing notices
 * with scheduling, priority, and acknowledgment tracking.
 *
 * @table announcements
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const AnnouncementsSchema = z.object({
	// Primary Key
	announcement_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid.optional().nullable(),

	// Announcement Content
	title: z.string().min(1).max(200),
	body: z.string().min(1),
	summary: z.string().max(500).optional().nullable(),

	// Classification
	announcement_type: z.string().max(50),

	// Audience
	audience: z.string().max(20).default("STAFF"),
	target_roles: z.array(z.string()).optional().nullable(),
	target_departments: z.array(z.string()).optional().nullable(),

	// Priority
	priority: z.string().max(20).default("NORMAL"),
	is_pinned: z.boolean().default(false),

	// Scheduling
	publish_at: z.coerce.date().optional().nullable(),
	expire_at: z.coerce.date().optional().nullable(),
	is_published: z.boolean().default(false),
	published_at: z.coerce.date().optional().nullable(),
	published_by: uuid.optional().nullable(),

	// Acknowledgment
	requires_acknowledgment: z.boolean().default(false),
	acknowledgment_deadline: z.coerce.date().optional().nullable(),

	// Media
	image_url: z.string().max(500).optional().nullable(),
	attachment_urls: z.array(z.unknown()).optional(),

	// Status
	is_active: z.boolean().default(true),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),
});

export type Announcements = z.infer<typeof AnnouncementsSchema>;

export const CreateAnnouncementsSchema = AnnouncementsSchema.omit({
	announcement_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
	published_at: true,
});

export type CreateAnnouncements = z.infer<typeof CreateAnnouncementsSchema>;

export const UpdateAnnouncementsSchema = AnnouncementsSchema.partial().omit({
	announcement_id: true,
	tenant_id: true,
	created_at: true,
	created_by: true,
});

export type UpdateAnnouncements = z.infer<typeof UpdateAnnouncementsSchema>;
