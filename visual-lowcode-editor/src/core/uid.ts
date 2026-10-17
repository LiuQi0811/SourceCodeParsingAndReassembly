export function uid(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}_${cryptoApi.randomUUID().slice(0, 8)}`;
  }
  const random = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}
