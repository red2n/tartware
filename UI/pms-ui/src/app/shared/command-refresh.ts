const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function settleCommandReadModel(
	refresh: () => Promise<unknown>,
	options?: { attempts?: number; delayMs?: number },
): Promise<void> {
	const attempts = options?.attempts ?? 4;
	const delayMs = options?.delayMs ?? 900;

	for (let attempt = 0; attempt < attempts; attempt++) {
		if (attempt > 0) {
			await sleep(delayMs);
		}
		await refresh();
	}
}
