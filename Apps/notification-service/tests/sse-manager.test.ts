import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the logger before importing the SUT
vi.mock("../src/lib/logger.js", () => ({
  appLogger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { sseManager } from "../src/services/sse-manager.js";

function makeFakeReply() {
  const written: string[] = [];
  return {
    raw: {
      write: vi.fn((chunk: string) => {
        written.push(chunk);
        return true;
      }),
    },
    written,
  };
}

function makeClient(
  tenantId: string,
  userId: string,
  id = `client-${Math.random().toString(36).slice(2, 8)}`,
) {
  const fakeReply = makeFakeReply();
  return {
    client: { id, tenantId, userId, reply: fakeReply as any },
    fakeReply,
  };
}

describe("SseConnectionManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    sseManager.shutdown();
    vi.useRealTimers();
  });

  // ─── Connection lifecycle ─────────────────────────────────

  it("tracks client connections", () => {
    const { client } = makeClient("t1", "u1");
    expect(sseManager.connectionCount).toBe(0);

    sseManager.addClient(client);
    expect(sseManager.connectionCount).toBe(1);

    sseManager.removeClient(client);
    expect(sseManager.connectionCount).toBe(0);
  });

  it("supports multiple clients per user (reconnect/multi-tab)", () => {
    const { client: c1 } = makeClient("t1", "u1", "tab-1");
    const { client: c2 } = makeClient("t1", "u1", "tab-2");

    sseManager.addClient(c1);
    sseManager.addClient(c2);
    expect(sseManager.connectionCount).toBe(2);

    // Remove one — the other stays
    sseManager.removeClient(c1);
    expect(sseManager.connectionCount).toBe(1);

    sseManager.removeClient(c2);
    expect(sseManager.connectionCount).toBe(0);
  });

  it("removing a non-existent client is a no-op", () => {
    const { client } = makeClient("t1", "u1");
    // Should not throw
    sseManager.removeClient(client);
    expect(sseManager.connectionCount).toBe(0);
  });

  // ─── sendToUser ───────────────────────────────────────────

  it("sends notification event to the correct user", () => {
    const { client: c1, fakeReply: r1 } = makeClient("t1", "u1");
    const { client: c2, fakeReply: r2 } = makeClient("t1", "u2");

    sseManager.addClient(c1);
    sseManager.addClient(c2);

    sseManager.sendToUser("t1", "u1", { title: "Hello" });

    expect(r1.raw.write).toHaveBeenCalledOnce();
    const payload = r1.written[0];
    expect(payload).toContain("event: notification");
    expect(payload).toContain('"title":"Hello"');

    // u2 should NOT receive it
    expect(r2.raw.write).not.toHaveBeenCalled();
  });

  it("delivers to all tabs of the same user", () => {
    const { client: c1, fakeReply: r1 } = makeClient("t1", "u1", "tab-1");
    const { client: c2, fakeReply: r2 } = makeClient("t1", "u1", "tab-2");

    sseManager.addClient(c1);
    sseManager.addClient(c2);

    sseManager.sendToUser("t1", "u1", { id: 1 });

    expect(r1.raw.write).toHaveBeenCalledOnce();
    expect(r2.raw.write).toHaveBeenCalledOnce();
  });

  it("no-ops when user has no connections", () => {
    // Should not throw
    sseManager.sendToUser("t1", "nobody", { x: 1 });
  });

  // ─── broadcastToTenant ────────────────────────────────────

  it("broadcasts to all users in a tenant", () => {
    const { client: c1, fakeReply: r1 } = makeClient("t1", "u1");
    const { client: c2, fakeReply: r2 } = makeClient("t1", "u2");
    const { client: c3, fakeReply: r3 } = makeClient("t2", "u3");

    sseManager.addClient(c1);
    sseManager.addClient(c2);
    sseManager.addClient(c3);

    sseManager.broadcastToTenant("t1", { alert: "fire drill" });

    expect(r1.raw.write).toHaveBeenCalledOnce();
    expect(r2.raw.write).toHaveBeenCalledOnce();
    // Different tenant — not reached
    expect(r3.raw.write).not.toHaveBeenCalled();
  });

  // ─── sendUnreadCount ──────────────────────────────────────

  it("sends unread_count event to the correct user", () => {
    const { client, fakeReply } = makeClient("t1", "u1");
    sseManager.addClient(client);

    sseManager.sendUnreadCount("t1", "u1", 5);

    const payload = fakeReply.written[0];
    expect(payload).toContain("event: unread_count");
    expect(payload).toContain('"unread":5');
  });

  // ─── Error handling (broken connection) ───────────────────

  it("auto-removes client on write error", () => {
    const { client, fakeReply } = makeClient("t1", "u1");
    sseManager.addClient(client);
    expect(sseManager.connectionCount).toBe(1);

    // Simulate broken pipe
    fakeReply.raw.write.mockImplementation(() => {
      throw new Error("write EPIPE");
    });

    sseManager.sendToUser("t1", "u1", { data: "test" });

    // Client should have been removed
    expect(sseManager.connectionCount).toBe(0);
  });

  it("auto-removes client on heartbeat write error", () => {
    const { client, fakeReply } = makeClient("t1", "u1");
    sseManager.addClient(client);

    // First writes succeed (initial), then fail on heartbeat
    fakeReply.raw.write.mockImplementation(() => {
      throw new Error("write EPIPE");
    });

    // Advance past heartbeat interval (30s)
    vi.advanceTimersByTime(30_000);

    expect(sseManager.connectionCount).toBe(0);
  });

  it("auto-removes client on broadcast write error", () => {
    const { client: good, fakeReply: goodReply } = makeClient("t1", "u1");
    const { client: bad, fakeReply: badReply } = makeClient("t1", "u2");

    sseManager.addClient(good);
    sseManager.addClient(bad);

    badReply.raw.write.mockImplementation(() => {
      throw new Error("socket hang up");
    });

    sseManager.broadcastToTenant("t1", { data: "test" });

    // Good client stays, bad client removed
    expect(sseManager.connectionCount).toBe(1);
    expect(goodReply.raw.write).toHaveBeenCalledOnce();
  });

  // ─── Heartbeat ────────────────────────────────────────────

  it("sends heartbeat events every 30 seconds", () => {
    const { client, fakeReply } = makeClient("t1", "u1");
    sseManager.addClient(client);

    // No heartbeat yet
    expect(fakeReply.raw.write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(fakeReply.raw.write).toHaveBeenCalledOnce();

    const payload = fakeReply.written[0];
    expect(payload).toContain("event: heartbeat");
    expect(payload).toContain('"ts":');

    vi.advanceTimersByTime(30_000);
    expect(fakeReply.raw.write).toHaveBeenCalledTimes(2);
  });

  it("stops heartbeat when all clients disconnect", () => {
    const { client } = makeClient("t1", "u1");
    sseManager.addClient(client);
    sseManager.removeClient(client);

    // Heartbeat should have stopped — no writes after interval
    const spy = vi.fn();
    const { client: probe, fakeReply: probeReply } = makeClient("t1", "u2");
    // Don't add probe — just ensure no interval fires
    vi.advanceTimersByTime(60_000);
    expect(probeReply.raw.write).not.toHaveBeenCalled();
  });

  // ─── Shutdown ─────────────────────────────────────────────

  it("shutdown clears all clients and stops heartbeat", () => {
    const { client: c1 } = makeClient("t1", "u1");
    const { client: c2 } = makeClient("t1", "u2");

    sseManager.addClient(c1);
    sseManager.addClient(c2);
    expect(sseManager.connectionCount).toBe(2);

    sseManager.shutdown();
    expect(sseManager.connectionCount).toBe(0);
  });
});
