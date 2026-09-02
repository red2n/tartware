/**
 * Bearer token parsing and membership loading.
 *
 * Both sit on the authentication path, so a permissive parse or a silently
 * dropped membership field is a security question rather than a cosmetic one.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMembershipLoader } from "../src/membership.js";
import { extractBearerToken } from "../src/jwt.js";
describe("extractBearerToken", () => {
    it("reads the token out of a well-formed header", () => {
        assert.equal(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
    });
    it("accepts the scheme in any case, as RFC 7235 requires", () => {
        assert.equal(extractBearerToken("bearer abc"), "abc");
        assert.equal(extractBearerToken("BEARER abc"), "abc");
    });
    it("trims surrounding whitespace from the token", () => {
        assert.equal(extractBearerToken("Bearer  abc "), "abc");
    });
    it("rejects anything that is not a bearer credential", () => {
        assert.equal(extractBearerToken("Basic abc"), null);
        assert.equal(extractBearerToken("abc"), null);
        assert.equal(extractBearerToken("Bearer"), null);
        assert.equal(extractBearerToken(""), null);
        assert.equal(extractBearerToken(undefined), null);
    });
});
describe("createMembershipLoader", () => {
    const row = {
        tenant_id: "11111111-1111-1111-1111-111111111111",
        tenant_name: "Grand Hotel",
        role: "ADMIN",
        is_active: true,
        permissions: { billing: true },
        modules: ["billing", "rooms"],
    };
    it("maps a row onto the membership shape", async () => {
        const getMemberships = createMembershipLoader(async () => ({ rows: [row] }));
        assert.deepEqual(await getMemberships("user-1"), [
            {
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                role: "ADMIN",
                isActive: true,
                permissions: { billing: true },
                modules: ["billing", "rooms"],
            },
        ]);
    });
    it("queries for the user it was asked about", async () => {
        const calls = [];
        const getMemberships = createMembershipLoader(async (_sql, params) => {
            calls.push(params);
            return { rows: [] };
        });
        await getMemberships("user-42");
        assert.deepEqual(calls, [["user-42"]]);
    });
    it("defaults absent permissions and modules rather than passing null through", async () => {
        const getMemberships = createMembershipLoader(async () => ({
            rows: [{ ...row, permissions: null, modules: null }],
        }));
        const [membership] = await getMemberships("user-1");
        assert.deepEqual(membership?.permissions, {});
        assert.deepEqual(membership?.modules, []);
    });
    it("rejects a role the enum does not allow instead of trusting the row", async () => {
        const getMemberships = createMembershipLoader(async () => ({
            rows: [{ ...row, role: "SUPERUSER" }],
        }));
        await assert.rejects(() => getMemberships("user-1"));
    });
    it("returns nothing for a user with no memberships", async () => {
        const getMemberships = createMembershipLoader(async () => ({ rows: [] }));
        assert.deepEqual(await getMemberships("user-1"), []);
    });
});
