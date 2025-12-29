import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";
import type { AuthUser } from "../types/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

const normalizePublicKey = (key: string) => key.replace(/\\n/g, "\n").trim();

export const authPlugin = fp(async (app) => {
  if (process.env.DISABLE_AUTH === "true") {
    app.log.warn("Auth disabled via DISABLE_AUTH");
    app.decorate("authenticate", async () => undefined);
    return;
  }

  await app.register(fastifyJwt, {
    secret: {
      public: normalizePublicKey(config.auth.publicKey),
    },
    verify: {
      algorithms: ["RS256"],
      allowedAud: config.auth.audience,
      allowedIss: config.auth.issuer,
    },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<AuthUser>();
      if (!payload.tenantId) {
        request.log.warn("Missing tenantId claim in JWT");
        return reply.status(403).send({ message: "Tenant context required" });
      }
      request.authUser = payload;
    } catch (error) {
      request.log.warn({ err: error }, "Authentication failed");
      return reply.status(401).send({ message: "Unauthorized" });
    }
  });
});
