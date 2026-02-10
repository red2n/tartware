import type { FastifyInstance, FastifyReply } from "fastify";
import { buildRouteSchema } from "@tartware/openapi";

import { gatewayConfig, kafkaConfig } from "../config.js";
import { healthResponseSchema, readinessResponseSchema, HEALTH_TAG } from "./schemas.js";

export const registerHealthRoutes = (app: FastifyInstance): void => {
  const kafkaSummary = {
    activeCluster: kafkaConfig.activeCluster,
    brokers: kafkaConfig.brokers,
    primaryBrokers: kafkaConfig.primaryBrokers,
    failoverBrokers: kafkaConfig.failoverBrokers,
    topic: kafkaConfig.commandTopic,
  } as const;

  const allowCorsHeaders = (reply: FastifyReply): FastifyReply =>
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
      .header(
        "Access-Control-Allow-Headers",
        "Accept, Authorization, Content-Type, X-Requested-With, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform",
      )
      .header("Access-Control-Max-Age", "600");

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
};
