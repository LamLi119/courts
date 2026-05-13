/**
 * Base URL for the Courts API (same logic as db.ts apiFetch).
 * Empty string means same-origin paths like `/api/...`.
 */
export function getCourtApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim();
  if (!raw) return '';
  let base = raw.replace(/\/+$/, '');
  base = base.replace(/(?:\/api)+$/, '');
  return base;
}

export function courtApiUrl(path: string): string {
  const base = getCourtApiBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
