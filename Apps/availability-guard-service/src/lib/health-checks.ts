import { query } from "./db.js";

export const checkDatabaseHealth = async (): Promise<void> => {
  await query("SELECT 1");
};
