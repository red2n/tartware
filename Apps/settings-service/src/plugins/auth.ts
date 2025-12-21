import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser?: unknown;
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
      request.authUser = await request.jwtVerify();
    } catch (error) {
      request.log.warn({ err: error }, "Authentication failed");
      void reply.status(401).send({ message: "Unauthorized" });
    }
  });
});
