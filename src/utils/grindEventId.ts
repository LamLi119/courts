/** Matches The Grind app: base64(encodeURIComponent(String(id))). */
export function encryptGrindEventId(id: number): string {
  return btoa(encodeURIComponent(String(id)));
}
