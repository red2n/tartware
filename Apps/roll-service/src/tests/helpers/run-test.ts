export const runTest = async (
  name: string,
  fn: () => Promise<void> | void,
): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : error;
    console.error(`[FAIL] ${name}`, message);
    process.exitCode = 1;
  }
};
