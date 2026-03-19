import { createStandardAuthPlugin } from "@tartware/tenant-auth/auth-plugin";

import { config } from "../config.js";
import { query } from "../lib/db.js";

export default createStandardAuthPlugin({
  jwtConfig: config.auth.jwt,
  query,
});
