export function generateDeviceFingerprint(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `ui-${cryptoObj.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `ui-${time}-${rand}`;
}
