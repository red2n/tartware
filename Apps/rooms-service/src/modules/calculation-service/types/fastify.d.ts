import "@fastify/sensible";

declare module "fastify" {
  interface FastifySchema {
    description?: string;
    tags?: string[];
    summary?: string;
  }
}
