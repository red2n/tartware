import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import rateLimit from "@fastify/rate-limit";
import { buildFastifyServer } from "@tartware/fastify-server";
import {
	buildRouteSchema,
	type JsonSchema,
	jsonObjectSchema,
} from "@tartware/openapi";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
	devToolsConfig,
	gatewayConfig,
	kafkaConfig,
	serviceTargets,
} from "./config.js";
import { registerDuploDashboard } from "./devtools/duplo-dashboard.js";
import { gatewayLogger } from "./logger.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { submitCommand } from "./utils/command-publisher.js";
import { proxyRequest } from "./utils/proxy.js";

const HEALTH_TAG = "Gateway Health";
const RESERVATION_PROXY_TAG = "Reservation Proxy";
const CORE_PROXY_TAG = "Core Proxy";
const COMMAND_CENTER_PROXY_TAG = "Command Center Proxy";
const SETTINGS_PROXY_TAG = "Settings Proxy";
const GUESTS_PROXY_TAG = "Guests Proxy";
const BILLING_PROXY_TAG = "Billing Proxy";
const HOUSEKEEPING_COMMAND_TAG = "Housekeeping Commands";
const ROOM_COMMAND_TAG = "Room Commands";
const BILLING_COMMAND_TAG = "Billing Commands";
const RECOMMENDATION_PROXY_TAG = "Recommendations";

const healthResponseSchema = {
	type: "object",
	properties: {
		status: { type: "string" },
		service: { type: "string" },
	},
	required: ["status", "service"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const readinessResponseSchema = {
	type: "object",
	properties: {
		status: { type: "string" },
		service: { type: "string" },
		kafka: {
			type: "object",
			properties: {
				activeCluster: { type: "string" },
				brokers: { type: "array", items: { type: "string" } },
				primaryBrokers: { type: "array", items: { type: "string" } },
				failoverBrokers: { type: "array", items: { type: "string" } },
				topic: { type: "string" },
			},
			required: [
				"activeCluster",
				"brokers",
				"primaryBrokers",
				"failoverBrokers",
				"topic",
			],
			additionalProperties: false,
		},
	},
	required: ["status", "service", "kafka"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const reservationParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier for the proxied reservation call.",
		},
	},
	required: ["tenantId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantTaskParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		taskId: {
			type: "string",
			format: "uuid",
			description: "Housekeeping task identifier.",
		},
	},
	required: ["tenantId", "taskId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantRoomParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		roomId: {
			type: "string",
			format: "uuid",
			description: "Room identifier.",
		},
	},
	required: ["tenantId", "roomId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantGuestParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		guestId: {
			type: "string",
			format: "uuid",
			description: "Guest identifier.",
		},
	},
	required: ["tenantId", "guestId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantReservationParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		reservationId: {
			type: "string",
			format: "uuid",
			description: "Reservation identifier.",
		},
	},
	required: ["tenantId", "reservationId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantPaymentParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		paymentId: {
			type: "string",
			format: "uuid",
			description: "Payment identifier.",
		},
	},
	required: ["tenantId", "paymentId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantInvoiceParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		invoiceId: {
			type: "string",
			format: "uuid",
			description: "Invoice identifier.",
		},
	},
	required: ["tenantId", "invoiceId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantCommandParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		commandName: {
			type: "string",
			description: "Command name to dispatch.",
		},
	},
	required: ["tenantId", "commandName"],
	additionalProperties: false,
} as const satisfies JsonSchema;

export const buildServer = () => {
	// API Gateway doesn't expose metrics endpoint (handled by individual services)
	const app = buildFastifyServer({
		logger: gatewayLogger,
		enableRequestLogging: gatewayConfig.logRequests,
		corsOrigin: false, // Custom CORS handling below
		enableMetricsEndpoint: false, // Gateway doesn't expose metrics
	});

	// Register swagger and auth plugins
	app.register(swaggerPlugin);
	app.register(authContextPlugin);

	// Register rate limiting
	app.register(
		rateLimit as unknown as FastifyPluginAsync,
		{
			max: gatewayConfig.rateLimit.max,
			timeWindow: gatewayConfig.rateLimit.timeWindow,
			keyGenerator: (request: FastifyRequest) =>
				(request.headers["x-api-key"] as string | undefined) ??
				request.ip ??
				"anonymous",
			ban: 0,
		} as unknown as RateLimitPluginOptions,
	);

	app.after(() => {
		const kafkaSummary = {
			activeCluster: kafkaConfig.activeCluster,
			brokers: kafkaConfig.brokers,
			primaryBrokers: kafkaConfig.primaryBrokers,
			failoverBrokers: kafkaConfig.failoverBrokers,
			topic: kafkaConfig.commandTopic,
		} as const;

		if (devToolsConfig.duploDashboard.enabled) {
			registerDuploDashboard(app, {
				sharedSecret: devToolsConfig.duploDashboard.sharedSecret,
			});
		} else {
			app.log.debug("Duplo dashboard disabled for this environment");
		}

		const allowCorsHeaders = (reply: FastifyReply): FastifyReply =>
			reply
				.header("Access-Control-Allow-Origin", "*")
				.header(
					"Access-Control-Allow-Methods",
					"GET,POST,PUT,PATCH,DELETE,OPTIONS",
				)
				.header(
					"Access-Control-Allow-Headers",
					"Accept, Authorization, Content-Type, X-Requested-With, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform",
				)
				.header("Access-Control-Max-Age", "600");

		app.addHook("onRequest", async (request, reply) => {
			allowCorsHeaders(reply);
			if (request.method.toUpperCase() === "OPTIONS") {
				return reply.status(204).send();
			}
		});

		app.options(
			"/health",
			{
				schema: {
					tags: [HEALTH_TAG],
					summary: "Pre-flight health request (CORS).",
					hide: true,
					response: {
						204: {
							type: "null",
							description: "CORS pre-flight acknowledgement.",
						},
					},
				},
			},
			async (_request, reply) => {
				allowCorsHeaders(reply);
				return reply.status(204).send();
			},
		);

		app.get(
			"/health",
			{
				schema: buildRouteSchema({
					tag: HEALTH_TAG,
					summary: "API gateway health status.",
					response: {
						200: healthResponseSchema,
					},
				}),
			},
			async (_request, reply) => {
				allowCorsHeaders(reply);
				return reply.send({
					status: "ok",
					service: gatewayConfig.serviceId,
				});
			},
		);

		app.get(
			"/ready",
			{
				schema: buildRouteSchema({
					tag: HEALTH_TAG,
					summary: "API gateway readiness status.",
					response: {
						200: readinessResponseSchema,
					},
				}),
			},
			async (_request, reply) => {
				allowCorsHeaders(reply);
				return reply.send({
					status: "ok",
					service: gatewayConfig.serviceId,
					kafka: kafkaSummary,
				});
			},
		);

		const reservationHandler = async (
			request: FastifyRequest,
			reply: FastifyReply,
		) => {
			if (request.method.toUpperCase() === "GET") {
				return proxyRequest(request, reply, serviceTargets.coreServiceUrl);
			}
			return forwardReservationCommand(request, reply);
		};

		const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
			proxyRequest(request, reply, serviceTargets.coreServiceUrl);

		const tenantScopeFromParams = app.withTenantScope({
			resolveTenantId: (request) =>
				(request.params as { tenantId?: string }).tenantId,
			minRole: "STAFF",
			requiredModules: "core",
		});

		app.get(
			"/v1/reservations",
			{
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Proxy reservation queries to core service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/tenants",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "List tenants accessible to the authenticated user.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		// Properties routes - proxy to core service
		app.get(
			"/v1/properties",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "List properties for a tenant.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		app.post(
			"/v1/properties",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Create a new property.",
					body: jsonObjectSchema,
					response: {
						201: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/properties/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy property operations to core service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		// Dashboard routes - proxy to core service
		app.all(
			"/v1/dashboard/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy dashboard requests to core service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		// Modules routes - proxy to core service
		app.get(
			"/v1/modules/catalog",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "List available platform modules.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/tenants/:tenantId/modules",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "List modules enabled for a tenant.",
					params: reservationParamsSchema,
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		// Reports routes - proxy to core service
		app.all(
			"/v1/reports/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy report requests to core service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/tenants/:tenantId/reservations",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Proxy tenant reservation requests to the backing services.",
					params: reservationParamsSchema,
					response: {
						200: jsonObjectSchema,
						201: jsonObjectSchema,
						202: jsonObjectSchema,
					},
				}),
			},
			reservationHandler,
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/check-in",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Check in a reservation via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.check_in",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/check-out",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Check out a reservation via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.check_out",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/assign-room",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Assign a room to a reservation via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.assign_room",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/unassign-room",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Unassign a room from a reservation via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.unassign_room",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/extend",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Extend a reservation stay via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.extend_stay",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/rate-override",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Override reservation rates via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.rate_override",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/deposit/add",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Add a deposit to a reservation via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.add_deposit",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/reservations/:reservationId/deposit/release",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Release a reservation deposit via Command Center.",
					params: tenantReservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "reservation.release_deposit",
					paramKey: "reservationId",
					payloadKey: "reservation_id",
				}),
		);

		app.all(
			"/v1/auth",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy auth calls to core service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/auth/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy auth calls to core service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/system/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy system admin calls to core service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyCore,
		);

		const proxyCommandCenter = async (
			request: FastifyRequest,
			reply: FastifyReply,
		) => proxyRequest(request, reply, serviceTargets.commandCenterServiceUrl);

		app.all(
			"/v1/commands",
			{
				schema: buildRouteSchema({
					tag: COMMAND_CENTER_PROXY_TAG,
					summary: "Proxy command center calls to the command-center service.",
					response: {
						200: jsonObjectSchema,
						202: jsonObjectSchema,
					},
				}),
			},
			proxyCommandCenter,
		);

		app.all(
			"/v1/commands/*",
			{
				schema: buildRouteSchema({
					tag: COMMAND_CENTER_PROXY_TAG,
					summary: "Proxy command center calls to the command-center service.",
					response: {
						200: jsonObjectSchema,
						202: jsonObjectSchema,
					},
				}),
			},
			proxyCommandCenter,
		);

		app.post(
			"/v1/tenants/:tenantId/commands/:commandName",
			{
				schema: buildRouteSchema({
					tag: COMMAND_CENTER_PROXY_TAG,
					summary: "Dispatch a command by name via the Command Center.",
					params: tenantCommandParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardGenericCommand,
		);

		app.all(
			"/v1/tenants/:tenantId/reservations/*",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Proxy nested reservation resource calls.",
					params: reservationParamsSchema,
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			reservationHandler,
		);

		const proxySettings = async (
			request: FastifyRequest,
			reply: FastifyReply,
		) => proxyRequest(request, reply, serviceTargets.settingsServiceUrl);

		app.all(
			"/v1/settings",
			{
				schema: buildRouteSchema({
					tag: SETTINGS_PROXY_TAG,
					summary: "Proxy settings requests to the settings service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxySettings,
		);

		app.all(
			"/v1/settings/*",
			{
				schema: buildRouteSchema({
					tag: SETTINGS_PROXY_TAG,
					summary: "Proxy settings requests to the settings service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxySettings,
		);

		const proxyGuests = async (request: FastifyRequest, reply: FastifyReply) =>
			proxyRequest(request, reply, serviceTargets.guestsServiceUrl);

		const proxyRooms = async (request: FastifyRequest, reply: FastifyReply) =>
			proxyRequest(request, reply, serviceTargets.roomsServiceUrl);

		const proxyHousekeeping = async (
			request: FastifyRequest,
			reply: FastifyReply,
		) => proxyRequest(request, reply, serviceTargets.housekeepingServiceUrl);

		const proxyBilling = async (request: FastifyRequest, reply: FastifyReply) =>
			proxyRequest(request, reply, serviceTargets.billingServiceUrl);

		app.get(
			"/v1/guests",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Proxy guest queries to the guests service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyGuests,
		);

		app.post(
			"/v1/guests",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary:
						"Submit guest creation requests via the Command Center command pipeline.",
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardGuestRegisterCommand,
		);

		app.post(
			"/v1/guests/merge",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Merge duplicate guests via the Command Center pipeline.",
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardGuestMergeCommand,
		);

		app.post(
			"/v1/tenants/:tenantId/guests/:guestId/profile",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Update guest profile details via Command Center.",
					params: tenantGuestParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "guest.update_profile",
					paramKey: "guestId",
					payloadKey: "guest_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/guests/:guestId/contact",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Update guest contact details via Command Center.",
					params: tenantGuestParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "guest.update_contact",
					paramKey: "guestId",
					payloadKey: "guest_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/guests/:guestId/loyalty",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Update guest loyalty information via Command Center.",
					params: tenantGuestParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "guest.set_loyalty",
					paramKey: "guestId",
					payloadKey: "guest_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/guests/:guestId/vip",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Update guest VIP status via Command Center.",
					params: tenantGuestParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "guest.set_vip",
					paramKey: "guestId",
					payloadKey: "guest_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/guests/:guestId/blacklist",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Update guest blacklist status via Command Center.",
					params: tenantGuestParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "guest.set_blacklist",
					paramKey: "guestId",
					payloadKey: "guest_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/guests/:guestId/gdpr-erase",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Erase guest data for GDPR via Command Center.",
					params: tenantGuestParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "guest.gdpr.erase",
					paramKey: "guestId",
					payloadKey: "guest_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/guests/:guestId/preferences",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Update guest preferences via Command Center.",
					params: tenantGuestParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "guest.preference.update",
					paramKey: "guestId",
					payloadKey: "guest_id",
				}),
		);

		app.get(
			"/v1/guests/*",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Proxy nested guest routes to the guests service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyGuests,
		);

		app.get(
			"/v1/rooms",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room queries to the rooms service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.post(
			"/v1/rooms",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room creation to the rooms service.",
					body: jsonObjectSchema,
					response: {
						201: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.all(
			"/v1/rooms/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room updates to the rooms service.",
					response: {
						200: jsonObjectSchema,
						204: { type: "null" },
					},
				}),
			},
			proxyRooms,
		);

		app.get(
			"/v1/room-types",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room type list requests to the rooms service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.post(
			"/v1/room-types",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room type creation to the rooms service.",
					body: jsonObjectSchema,
					response: {
						201: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.get(
			"/v1/room-types/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room type detail requests to the rooms service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.put(
			"/v1/room-types/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room type updates to the rooms service.",
					body: jsonObjectSchema,
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.patch(
			"/v1/room-types/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room type partial updates to the rooms service.",
					body: jsonObjectSchema,
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.delete(
			"/v1/room-types/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room type deletion to the rooms service.",
					response: {
						204: { type: "null" },
					},
				}),
			},
			proxyRooms,
		);

		// Rates routes - proxy to rooms service
		app.get(
			"/v1/rates",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "List rates for a tenant.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.post(
			"/v1/rates",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Create a new rate.",
					body: jsonObjectSchema,
					response: {
						201: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.all(
			"/v1/rates/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy rate operations to rooms service.",
					response: {
						200: jsonObjectSchema,
						204: { type: "null" },
					},
				}),
			},
			proxyRooms,
		);

		// Booking Configuration routes - proxy to core service
		const BOOKING_CONFIG_TAG = "Booking Configuration";

		app.get(
			"/v1/allotments",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List allotments (room blocks for groups/events).",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/allotments/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy allotment operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/booking-sources",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List booking sources (OTAs, GDS, direct channels).",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/booking-sources/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy booking source operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/market-segments",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List market segments for guest categorization.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/market-segments/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy market segment operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/channel-mappings",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List OTA/GDS channel mappings.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/channel-mappings/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy channel mapping operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/companies",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List corporate accounts and business partners.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/companies/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy company operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/meeting-rooms",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List conference rooms and event spaces.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/meeting-rooms/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy meeting room operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/event-bookings",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List event bookings (meetings, conferences, banquets).",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/event-bookings/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy event booking operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/waitlist",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List waitlist entries for room availability.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/waitlist/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy waitlist operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Group Bookings - room blocks for corporate/group reservations
		app.get(
			"/v1/group-bookings",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List group bookings (corporate blocks, tours, events).",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/group-bookings/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy group booking operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Promotional Codes - discounts and marketing campaigns
		app.get(
			"/v1/promo-codes",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List promotional codes and discount campaigns.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/promo-codes/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy promotional code operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Night Audit - EOD processing and business date management
		app.get(
			"/v1/night-audit/status",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Get current business date status for a property.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.get(
			"/v1/night-audit/history",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List night audit run history.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/night-audit/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy night audit operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// OTA/Channel Connections - third-party booking integrations
		app.get(
			"/v1/ota-connections",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "List OTA and channel manager connections.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/ota-connections/*",
			{
				schema: buildRouteSchema({
					tag: BOOKING_CONFIG_TAG,
					summary: "Proxy OTA connection operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// =====================================================
		// OPERATIONS ENDPOINTS
		// =====================================================
		const OPERATIONS_TAG = "Operations";

		// Cashier Sessions
		app.get(
			"/v1/cashier-sessions",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "List cashier sessions.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/cashier-sessions/*",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "Proxy cashier session operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Shift Handovers
		app.get(
			"/v1/shift-handovers",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "List shift handovers.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/shift-handovers/*",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "Proxy shift handover operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Lost and Found
		app.get(
			"/v1/lost-and-found",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "List lost and found items.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/lost-and-found/*",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "Proxy lost and found operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Banquet Event Orders
		app.get(
			"/v1/banquet-orders",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "List banquet event orders (BEOs).",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/banquet-orders/*",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "Proxy banquet order operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Guest Feedback
		app.get(
			"/v1/guest-feedback",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "List guest feedback and reviews.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/guest-feedback/*",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "Proxy guest feedback operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		// Police Reports
		app.get(
			"/v1/police-reports",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "List police/incident reports.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.all(
			"/v1/police-reports/*",
			{
				schema: buildRouteSchema({
					tag: OPERATIONS_TAG,
					summary: "Proxy police report operations to core service.",
					response: { 200: jsonObjectSchema },
				}),
			},
			proxyCore,
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/block",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Block a room's inventory via the Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardRoomInventoryCommand({
					request,
					reply,
					action: "block",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/release",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Release a manual room block via the Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardRoomInventoryCommand({
					request,
					reply,
					action: "release",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/status",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Update room status via Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "rooms.status.update",
					paramKey: "roomId",
					payloadKey: "room_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/housekeeping-status",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Update room housekeeping status via Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "rooms.housekeeping_status.update",
					paramKey: "roomId",
					payloadKey: "room_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/out-of-order",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Mark room out of order via Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "rooms.out_of_order",
					paramKey: "roomId",
					payloadKey: "room_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/out-of-service",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Mark room out of service via Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "rooms.out_of_service",
					paramKey: "roomId",
					payloadKey: "room_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/features",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Update room features via Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "rooms.features.update",
					paramKey: "roomId",
					payloadKey: "room_id",
				}),
		);

		app.get(
			"/v1/housekeeping/tasks",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary:
						"Proxy housekeeping task queries to the housekeeping service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyHousekeeping,
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/:taskId/assign",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Assign a housekeeping task via the Command Center.",
					params: tenantTaskParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardHousekeepingAssignCommand,
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/:taskId/complete",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Complete a housekeeping task via the Command Center.",
					params: tenantTaskParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardHousekeepingCompleteCommand,
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Create a housekeeping task via the Command Center.",
					params: reservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithTenant({
					request,
					reply,
					commandName: "housekeeping.task.create",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/:taskId/reassign",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Reassign a housekeeping task via the Command Center.",
					params: tenantTaskParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "housekeeping.task.reassign",
					paramKey: "taskId",
					payloadKey: "task_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/:taskId/reopen",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Reopen a housekeeping task via the Command Center.",
					params: tenantTaskParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "housekeeping.task.reopen",
					paramKey: "taskId",
					payloadKey: "task_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/:taskId/notes",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Add a housekeeping task note via the Command Center.",
					params: tenantTaskParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "housekeeping.task.add_note",
					paramKey: "taskId",
					payloadKey: "task_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/bulk-status",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Bulk update housekeeping tasks via the Command Center.",
					params: reservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithTenant({
					request,
					reply,
					commandName: "housekeeping.task.bulk_status",
				}),
		);

		app.get(
			"/v1/billing/payments",
			{
				schema: buildRouteSchema({
					tag: BILLING_PROXY_TAG,
					summary: "Proxy billing payment requests to the billing service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyBilling,
		);

		app.post(
			"/v1/tenants/:tenantId/billing/payments/capture",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Capture a payment via the Command Center.",
					params: reservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardBillingCaptureCommand,
		);

		app.post(
			"/v1/tenants/:tenantId/billing/payments/:paymentId/refund",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Refund a payment via the Command Center.",
					params: tenantPaymentParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardBillingRefundCommand,
		);

		app.post(
			"/v1/tenants/:tenantId/billing/invoices",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Create an invoice via the Command Center.",
					params: reservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithTenant({
					request,
					reply,
					commandName: "billing.invoice.create",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/billing/invoices/:invoiceId/adjust",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Adjust an invoice via the Command Center.",
					params: tenantInvoiceParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "billing.invoice.adjust",
					paramKey: "invoiceId",
					payloadKey: "invoice_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/billing/charges",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Post a charge via the Command Center.",
					params: reservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithTenant({
					request,
					reply,
					commandName: "billing.charge.post",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/billing/payments/:paymentId/apply",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Apply a payment via the Command Center.",
					params: tenantPaymentParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithParamId({
					request,
					reply,
					commandName: "billing.payment.apply",
					paramKey: "paymentId",
					payloadKey: "payment_id",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/billing/folios/transfer",
			{
				preHandler: tenantScopeFromParams,
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Transfer a folio balance via the Command Center.",
					params: reservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardCommandWithTenant({
					request,
					reply,
					commandName: "billing.folio.transfer",
				}),
		);

		app.get(
			"/v1/billing/*",
			{
				schema: buildRouteSchema({
					tag: BILLING_PROXY_TAG,
					summary: "Proxy nested billing routes to the billing service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyBilling,
		);

		// Recommendation routes - proxy to recommendation service
		const proxyRecommendations = async (
			request: FastifyRequest,
			reply: FastifyReply,
		) => proxyRequest(request, reply, serviceTargets.recommendationServiceUrl);

		app.get(
			"/v1/recommendations",
			{
				schema: buildRouteSchema({
					tag: RECOMMENDATION_PROXY_TAG,
					summary: "Get personalized room recommendations for a guest.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRecommendations,
		);

		app.post(
			"/v1/recommendations/rank",
			{
				schema: buildRouteSchema({
					tag: RECOMMENDATION_PROXY_TAG,
					summary: "Rank a list of rooms for a guest (personalized ordering).",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRecommendations,
		);

		app.all(
			"/v1/recommendations/*",
			{
				schema: buildRouteSchema({
					tag: RECOMMENDATION_PROXY_TAG,
					summary:
						"Proxy recommendation requests to the recommendation service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRecommendations,
		);

		app.get(
			"/v1/housekeeping/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy nested housekeeping routes to the service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyHousekeeping,
		);
	});

	return app;
};
const forwardGuestRegisterCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const body = toPlainObject(request.body);
	if (!body) {
		reply.badRequest("GUEST_PAYLOAD_REQUIRED");
		return;
	}

	const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}

	const payload = { ...body };
	delete payload.tenant_id;

	await submitCommand({
		request,
		reply,
		commandName: "guest.register",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardGuestMergeCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const body = toPlainObject(request.body);
	if (!body) {
		reply.badRequest("GUEST_MERGE_PAYLOAD_REQUIRED");
		return;
	}
	const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}
	if (
		typeof body.primary_guest_id !== "string" ||
		typeof body.duplicate_guest_id !== "string"
	) {
		reply.badRequest("PRIMARY_AND_DUPLICATE_GUEST_IDS_REQUIRED");
		return;
	}
	const payload = { ...body };
	delete payload.tenant_id;

	await submitCommand({
		request,
		reply,
		commandName: "guest.merge",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const getParamValue = (request: FastifyRequest, key: string): string | null => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const value = params[key];
	return typeof value === "string" ? value : null;
};

const forwardCommandWithTenant = async ({
	request,
	reply,
	commandName,
}: {
	request: FastifyRequest;
	reply: FastifyReply;
	commandName: string;
}): Promise<void> => {
	const tenantId = getParamValue(request, "tenantId");
	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}
	const payload = normalizePayloadObject(request.body);
	await submitCommand({
		request,
		reply,
		commandName,
		tenantId,
		payload,
		requiredRole: "MANAGER",
	});
};

const forwardCommandWithParamId = async ({
	request,
	reply,
	commandName,
	paramKey,
	payloadKey,
}: {
	request: FastifyRequest;
	reply: FastifyReply;
	commandName: string;
	paramKey: string;
	payloadKey: string;
}): Promise<void> => {
	const tenantId = getParamValue(request, "tenantId");
	const paramValue = getParamValue(request, paramKey);
	if (!tenantId || !paramValue) {
		reply.badRequest("TENANT_AND_RESOURCE_ID_REQUIRED");
		return;
	}
	const payload = {
		...normalizePayloadObject(request.body),
		[payloadKey]: paramValue,
	};
	await submitCommand({
		request,
		reply,
		commandName,
		tenantId,
		payload,
		requiredRole: "MANAGER",
	});
};

const forwardGenericCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const commandName =
		typeof params.commandName === "string" ? params.commandName : null;
	if (!tenantId || !commandName) {
		reply.badRequest("TENANT_AND_COMMAND_REQUIRED");
		return;
	}

	const payload = normalizePayloadObject(request.body);
	await submitCommand({
		request,
		reply,
		commandName,
		tenantId,
		payload,
		requiredRole: "MANAGER",
	});
};

const forwardReservationCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;

	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}

	const method = request.method.toUpperCase();
	let commandName: string;
	let payload: Record<string, unknown> = normalizePayloadObject(request.body);

	switch (method) {
		case "POST":
			commandName = "reservation.create";
			payload = normalizePayloadObject(request.body);
			break;
		case "PUT":
		case "PATCH":
			commandName = "reservation.modify";
			payload = normalizePayloadObject(request.body);
			break;
		case "DELETE":
			commandName = "reservation.cancel";
			payload = normalizePayloadObject(request.body);
			break;
		default:
			reply.status(405).send({
				error: "METHOD_NOT_ALLOWED",
				message: `Method ${method} is not supported for reservation commands`,
			});
			return;
	}

	if (commandName !== "reservation.create") {
		const reservationId = extractReservationId(params);
		if (!reservationId) {
			reply.badRequest("RESERVATION_ID_REQUIRED");
			return;
		}
		const payloadObject = payload as Record<string, unknown>;
		if (!payloadObject.reservation_id) {
			payloadObject.reservation_id = reservationId;
		}
		payload = payloadObject;
	}

	await submitCommand({
		request,
		reply,
		commandName,
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const normalizePayloadObject = (body: unknown): Record<string, unknown> => {
	if (body && typeof body === "object" && !Array.isArray(body)) {
		return { ...(body as Record<string, unknown>) };
	}
	if (body === undefined || body === null) {
		return {};
	}
	return { value: body };
};

const toPlainObject = (value: unknown): Record<string, unknown> | null => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return { ...(value as Record<string, unknown>) };
	}
	return null;
};

const extractReservationId = (
	params: Record<string, unknown>,
): string | null => {
	const direct = params.reservationId;
	if (typeof direct === "string" && direct.length > 0) {
		return direct;
	}
	const wildcard = params["*"];
	if (typeof wildcard === "string" && wildcard.length > 0) {
		return wildcard.split("/")[0] ?? null;
	}
	return null;
};

const forwardHousekeepingAssignCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const taskId = typeof params.taskId === "string" ? params.taskId : null;
	if (!tenantId || !taskId) {
		reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
		return;
	}

	const body = normalizePayloadObject(request.body);
	if (typeof body.assigned_to !== "string" || body.assigned_to.length === 0) {
		reply.badRequest("ASSIGNED_TO_REQUIRED");
		return;
	}

	const payload = { ...body, task_id: taskId };
	await submitCommand({
		request,
		reply,
		commandName: "housekeeping.task.assign",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardHousekeepingCompleteCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const taskId = typeof params.taskId === "string" ? params.taskId : null;
	if (!tenantId || !taskId) {
		reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
		return;
	}
	const payload = { ...normalizePayloadObject(request.body), task_id: taskId };
	await submitCommand({
		request,
		reply,
		commandName: "housekeeping.task.complete",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardRoomInventoryCommand = async ({
	request,
	reply,
	action,
}: {
	request: FastifyRequest;
	reply: FastifyReply;
	action: "block" | "release";
}): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const roomId = typeof params.roomId === "string" ? params.roomId : null;
	if (!tenantId || !roomId) {
		reply.badRequest("TENANT_AND_ROOM_ID_REQUIRED");
		return;
	}
	const payloadBase = {
		...normalizePayloadObject(request.body),
		room_id: roomId,
	};
	const payload =
		action === "release"
			? payloadBase
			: {
					...payloadBase,
					action,
				};
	await submitCommand({
		request,
		reply,
		commandName:
			action === "release"
				? "rooms.inventory.release"
				: "rooms.inventory.block",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardBillingCaptureCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}
	const payload = normalizePayloadObject(request.body);
	if (!payload) {
		reply.badRequest("BILLING_CAPTURE_PAYLOAD_REQUIRED");
		return;
	}
	await submitCommand({
		request,
		reply,
		commandName: "billing.payment.capture",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardBillingRefundCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const paymentId =
		typeof params.paymentId === "string" ? params.paymentId : null;
	if (!tenantId || !paymentId) {
		reply.badRequest("TENANT_AND_PAYMENT_ID_REQUIRED");
		return;
	}
	const body = normalizePayloadObject(request.body);
	const payload = { ...body, payment_id: paymentId };
	await submitCommand({
		request,
		reply,
		commandName: "billing.payment.refund",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};
