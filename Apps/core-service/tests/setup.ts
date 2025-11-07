import { beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mock the database module before any imports
vi.mock("../src/lib/db.js", () => import("./mocks/db.js"));

beforeAll(async () => {
  console.log("✓ Database mocks initialized for tests");
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterAll(async () => {
  console.log("✓ Test suite completed");
});
