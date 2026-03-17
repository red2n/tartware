import type { TenantRole } from "@tartware/schemas";

export const TENANT_ROLES: { value: TenantRole; label: string }[] = [
	{ value: "VIEWER", label: "Viewer" },
	{ value: "STAFF", label: "Staff" },
	{ value: "MANAGER", label: "Manager" },
	{ value: "ADMIN", label: "Admin" },
	{ value: "OWNER", label: "Owner" },
];
