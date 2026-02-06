import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const buildTsconfigAliases = (tsconfigRelativePath, importerUrl) => {
  const tsconfigUrl = new URL(tsconfigRelativePath, importerUrl);
  const tsconfigPath = fileURLToPath(tsconfigUrl);
  let tsconfig;

  try {
    const contents = readFileSync(tsconfigPath, "utf8");
    tsconfig = JSON.parse(contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const parseError = new Error(
      `Failed to load tsconfig from ${tsconfigPath}: ${reason}`,
    );
    parseError.cause = error;
    throw parseError;
  }
  const paths = tsconfig?.compilerOptions?.paths ?? {};
  const baseDir = path.resolve(
    path.dirname(tsconfigPath),
    tsconfig?.compilerOptions?.baseUrl ?? ".",
  );

  const aliases = Object.entries(paths).flatMap(([key, targetPaths]) => {
    const isKeyWildcard = key.endsWith("/*");
    // For wildcard keys like "@tartware/schemas/*", strip the trailing "*" to
    // produce a prefix string that Vite will match via startsWith.
    // For non-wildcard keys like "@tartware/schemas", use a regex anchored with $
    // so that the alias only matches the exact bare specifier, not subpath imports
    // like "@tartware/schemas/events/commands/billing".
    const find = isKeyWildcard
      ? key.slice(0, -1)
      : new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

    return targetPaths.map((targetPath) => {
      const isTargetWildcard = targetPath.endsWith("/*");
      const normalizedTarget = isTargetWildcard ? targetPath.slice(0, -1) : targetPath;
      const replacement = path.resolve(baseDir, normalizedTarget);
      return { find, replacement };
    });
  });

  return aliases;
};
