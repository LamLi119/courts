/**
 * Strip Unicode format chars (ZWJ, ZWSP, BOM, etc.) that break slug/name matching.
 * Venue id 8 historically had a leading U+200D in the name.
 */
export function stripInvisibleChars(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\p{Cf}/gu, '').replace(/\uFEFF/g, '');
}

/** Trim, collapse whitespace, and remove invisible format characters. */
export function cleanDisplayText(text: string): string {
  return stripInvisibleChars(text).trim().replace(/\s+/g, ' ');
}

/**
 * Convert venue name to URL-safe slug: lowercase, spaces to hyphens, strip non-alphanumeric.
 * Used for semantic URLs: /venues/the-grind-court-kwun-tong
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return cleanDisplayText(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
