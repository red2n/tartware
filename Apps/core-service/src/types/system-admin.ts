import type { SystemAdminRole } from "@tartware/schemas";
import type { preHandlerHookHandler } from "fastify";

export interface SystemAdminContext {
  adminId: string;
  username: string;
  role: SystemAdminRole;
  sessionId: string;
  scope: "SYSTEM_ADMIN";
}

export interface SystemAdminScopeOptions {
  minRole?: SystemAdminRole;
}

export type SystemAdminScopeDecorator = (
  options?: SystemAdminScopeOptions,
) => preHandlerHookHandler;
