import {
  type CommandRegistrySnapshot,
  createCommandRegistryRepository,
} from "@tartware/command-center-shared";

import { query } from "../../lib/db.js";

const { loadCommandRegistrySnapshot } = createCommandRegistryRepository(query);

export { loadCommandRegistrySnapshot };
export type { CommandRegistrySnapshot };
