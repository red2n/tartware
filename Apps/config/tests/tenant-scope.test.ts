/**
 * RLS tenant-scope containment.
 *
 * `query()` reads the ambient tenant scope and turns it into
 * `SET LOCAL app.current_tenant_id`, so whichever tenant is in scope when a
 * statement runs is the tenant the database enforces. A scope that outlives its
 * command is therefore not an untidiness — it is a cross-tenant read waiting
 * for a caller that forgot to set its own.
 *
 * `enterTenantScope` cannot give that containment: `enterWith` writes the scope
 * back into the calling context, which on a Kafka batch runner is shared by
 * every tenant the consumer serves. `runWithTenantScope` is what the consumers
 * use, so the containment it promises is asserted here rather than assumed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enterTenantScope, getTenantScope, runWithTenantScope } from "../src/db.js";

const TENANTS = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"];

const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("runWithTenantScope", () => {
	it("keeps concurrent tenants from observing each other's scope", async () => {
		// Mirrors partitionsConsumedConcurrently > 1: several commands for
		// different tenants interleaved on one loop, each awaiting DB round trips.
		const observed = await Promise.all(
			TENANTS.map((tenantId, index) =>
				runWithTenantScope(tenantId, async () => {
					await tick(index === 0 ? 8 : 1);
					const afterFirstAwait = getTenantScope();
					await tick(4);
					return { tenantId, afterFirstAwait, afterSecondAwait: getTenantScope() };
				}),
			),
		);

		for (const seen of observed) {
			assert.equal(seen.afterFirstAwait, seen.tenantId);
			assert.equal(seen.afterSecondAwait, seen.tenantId);
		}
	});

	it("leaves no scope behind for the next command to inherit", async () => {
		await runWithTenantScope(TENANTS[0] as string, async () => {
			await tick(1);
		});

		// The batch runner resumes here. Anything it queries now must be
		// unscoped rather than silently attributed to the command that just ran.
		assert.equal(getTenantScope(), undefined);
	});

	it("restores the enclosing scope rather than clearing it", async () => {
		await runWithTenantScope(TENANTS[0] as string, async () => {
			await runWithTenantScope(TENANTS[1] as string, async () => {
				await tick(1);
			});
			assert.equal(getTenantScope(), TENANTS[0]);
		});
	});
});

describe("enterTenantScope", () => {
	it("escapes into the calling context, which is why consumers cannot use it", async () => {
		// Documents the hazard the consumers were moved off. If a future change
		// makes `enterWith` contained, this test fails and the deprecation on
		// `onTenantResolved` can be revisited.
		await (async () => {
			enterTenantScope(TENANTS[1] as string);
			await tick(1);
		})();

		assert.equal(getTenantScope(), TENANTS[1]);
	});
});
