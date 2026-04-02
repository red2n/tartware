import type { HttpErrorReplys } from "@fastify/sensible";

declare module "fastify" {
  interface FastifyContextConfig {
    authContextPublic?: boolean;
  }

  interface FastifyReply extends HttpErrorReplys {}
}
