import type { HttpErrorReplys } from "@fastify/sensible";
import "@fastify/jwt"; // Expose FastifyRequest.jwtVerify and related augmentations

interface HttpErrorFactory {
  unauthorized(msg?: string): Error;
  forbidden(msg?: string): Error;
  badRequest(msg?: string): Error;
  notFound(msg?: string): Error;
  conflict(msg?: string): Error;
  internalServerError(msg?: string): Error;
}

declare module "fastify" {
  interface FastifyReply extends HttpErrorReplys {}

  interface FastifyInstance {
    httpErrors: HttpErrorFactory;
  }

  interface FastifyRequest {
    jwtVerify<T = unknown>(options?: Record<string, unknown>): Promise<T>;
  }
}
