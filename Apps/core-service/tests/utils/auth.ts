import { signAccessToken } from "../../src/lib/jwt.js";
import { TEST_USER_USERNAME } from "../mocks/db.js";

export const buildAuthHeader = (
  userId: string,
  username: string = TEST_USER_USERNAME,
  options: { mustChangePassword?: boolean } = {},
) => ({
  Authorization: `Bearer ${signAccessToken({
    sub: userId,
    username,
    type: "access",
    must_change_password: Boolean(options.mustChangePassword),
  })}`,
});
