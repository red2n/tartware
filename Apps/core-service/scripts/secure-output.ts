import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

export interface SecureOutputOptions {
  allowStdoutSecrets: boolean;
  outputPath?: string;
  outputFileName: string;
  tempDirPrefix: string;
  log: (message: string) => void;
}

export const writeSecureJsonOutput = (
  payload: Record<string, unknown>,
  options: SecureOutputOptions,
) => {
  if (options.allowStdoutSecrets) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const outputPath =
    options.outputPath ??
    join(mkdtempSync(join(tmpdir(), options.tempDirPrefix)), options.outputFileName);

  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(outputPath, 0o600);
  options.log(`Sensitive output written to ${outputPath}`);
};
