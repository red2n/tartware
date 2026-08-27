/**
 * Short-lived caching for the two reads a booking funnel repeats constantly.
 *
 * Availability search and rate lookup are, by the workload model this system is
 * sized against, roughly two of every three requests: a booking is preceded by
 * a search and a quote, and browsing produces many searches per booking. Under
 * load they were measured queueing to a ~9 s median while the same queries
 * answered in 6-10 ms idle — the cost is not the query, it is doing it again
 * for every caller asking the same question in the same second.
 *
 * **Why caching availability is safe here.** A cached availability *search* is
 * not the thing that prevents overbooking — `availability-guard-service` is,
 * and it is consulted when the reservation command is applied, not when the
 * page is browsed. So a search may be a second or two stale without any risk of
 * double-selling a room; the authoritative check still happens at booking. The
 * TTL is kept to seconds anyway, because a guest seeing a room that has just
 * gone is a bad experience even when it is not a correctness failure.
 *
 * Rates are reference data and change on an operator's timescale, so they carry
 * a longer TTL and are invalidated when a rate is written through this gateway.
 *
 * Cached per gateway process rather than shared: the entries are small, the TTLs
 * are short, and a shared cache would trade this for a network hop of its own.
 */

import {
  createReferenceCache,
  type ReferenceCache,
} from "@tartware/fastify-server/reference-cache";
import type { FastifyReply, FastifyRequest } from "fastify";

import { cachedReadConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";

import { proxyRequest, sendUpstream, type UpstreamResponse } from "./proxy.js";

const logger = gatewayLogger.child({ module: "cached-read" });

type CacheEntry = UpstreamResponse;

/**
 * Identify the request for cache purposes.
 *
 * The tenant is part of every key: these responses are tenant-scoped and
 * serving one tenant's availability to another would be a cross-tenant leak,
 * not merely a stale read. The full query string is included because every
 * parameter — dates, property, filters — changes the answer.
 */
const cacheKeyFor = (request: FastifyRequest, tenantId: string): string => {
  const url = new URL(request.raw.url ?? "/", "http://gateway");
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  return `${tenantId}|${url.pathname}|${params.map(([k, v]) => `${k}=${v}`).join("&")}`;
};

const tenantOf = (request: FastifyRequest): string | null => {
  const query = request.query as { tenant_id?: string } | undefined;
  return query?.tenant_id ?? null;
};

type CachedReadOptions = {
  name: string;
  ttlMs: number;
  maxSize: number;
  targetBaseUrl: () => string;
};

type CachedRead = {
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  /** Drop every entry for a tenant, e.g. after it writes a rate. */
  invalidateTenant: (tenantId: string) => void;
  size: () => number;
};

export const createCachedRead = (options: CachedReadOptions): CachedRead => {
  // Tracked alongside the cache so a tenant's entries can be dropped without
  // walking the whole store, which would otherwise mean clearing everyone's.
  const keysByTenant = new Map<string, Set<string>>();

  const cache: ReferenceCache<string, CacheEntry> = createReferenceCache<string, CacheEntry>({
    name: options.name,
    maxSize: options.maxSize,
    ttlMs: options.ttlMs,
    // Entries are only ever written by the handler below, which has the
    // response in hand; a loader that fetched again would defeat the purpose.
    loader: async () => null,
  });

  const remember = (tenantId: string, key: string, value: CacheEntry): void => {
    cache.primeMany([[key, value]]);
    const keys = keysByTenant.get(tenantId);
    if (keys) {
      keys.add(key);
    } else {
      keysByTenant.set(tenantId, new Set([key]));
    }
  };

  const handler = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const tenantId = tenantOf(request);
    if (!tenantId || !cachedReadConfig.enabled) {
      // Without a tenant there is no safe key, so this request goes upstream
      // uncached rather than sharing an entry across tenants.
      return proxyRequest(request, reply, options.targetBaseUrl());
    }

    const key = cacheKeyFor(request, tenantId);
    const hit = await cache.get(key);
    if (hit) {
      reply.header("x-tartware-cache", "hit");
      return sendUpstream(reply, hit);
    }

    reply.header("x-tartware-cache", "miss");
    return proxyRequest(request, reply, options.targetBaseUrl(), (result) => {
      // Only successful reads are cached. Caching an error would turn a
      // transient upstream blip into a sticky one for the whole TTL.
      if (result.status === 200) {
        remember(tenantId, key, result);
      }
    });
  };

  const invalidateTenant = (tenantId: string): void => {
    const keys = keysByTenant.get(tenantId);
    if (!keys) {
      return;
    }
    for (const key of keys) {
      cache.invalidate(key);
    }
    keysByTenant.delete(tenantId);
    logger.debug({ tenantId, cache: options.name }, "invalidated cached reads for tenant");
  };

  return { handler, invalidateTenant, size: cache.size };
};
