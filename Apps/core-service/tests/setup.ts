import { beforeAll, afterAll } from "vitest";
import { query } from "../src/lib/db.js";

beforeAll(async () => {
  // Verify database connection
  try {
    await query("SELECT 1 as health_check");
    console.log("✓ Database connection established for tests");
  } catch (error) {
    console.error("✗ Failed to connect to database:", error);
    throw error;
  }
});

afterAll(async () => {
  // Cleanup connections if needed
  console.log("✓ Test suite completed");
});
