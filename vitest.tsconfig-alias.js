import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const buildTsconfigAliases = (tsconfigRelativePath, importerUrl) => {
  const tsconfigUrl = new URL(tsconfigRelativePath, importerUrl);
  const tsconfigPath = fileURLToPath(tsconfigUrl);
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
  const paths = tsconfig?.compilerOptions?.paths ?? {};
  const baseDir = path.resolve(
    path.dirname(tsconfigPath),
    tsconfig?.compilerOptions?.baseUrl ?? ".",
  );

  return Object.entries(paths).flatMap(([key, targetPaths]) => {
    const isKeyWildcard = key.endsWith("/*");
    const find = isKeyWildcard ? key.slice(0, -1) : key;

    return targetPaths.map((targetPath) => {
      const isTargetWildcard = targetPath.endsWith("/*");
      const normalizedTarget = isTargetWildcard ? targetPath.slice(0, -1) : targetPath;
      const replacement = path.resolve(baseDir, normalizedTarget);
      return { find, replacement };
    });
  });
};
