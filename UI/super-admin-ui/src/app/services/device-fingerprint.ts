export function generateDeviceFingerprint(): string {
  // Check if localStorage is available (not available during SSR)
  if (typeof localStorage !== 'undefined') {
    // Check if we already have a stored fingerprint
    const stored = localStorage.getItem('device_fingerprint');
    if (stored) {
      return stored;
    }
  }

  // Generate a new fingerprint
  const cryptoObj = globalThis.crypto;
  let fingerprint: string;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    fingerprint = `ui-${cryptoObj.randomUUID()}`;
  } else {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    fingerprint = `ui-${time}-${rand}`;
  }

  // Store it for future use (only if localStorage is available)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('device_fingerprint', fingerprint);
  }
  return fingerprint;
}
