import type { HttpErrorReplys } from "@fastify/sensible";

declare module "fastify" {
  interface FastifyReply extends HttpErrorReplys {}
}
