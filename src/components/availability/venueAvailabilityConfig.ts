/**
 * Venues that show the "Available to book" tab (data from n8n webhook).
 * Add new venue IDs here when their n8n workflow branch is ready.
 */
export const AVAILABILITY_VENUE_IDS = new Set<number>([7, 8, 9, 10, 15, 19, 24, 25, 44, 56, 61]);

export function isVenueAvailabilityEnabled(venueId: number): boolean {
  return AVAILABILITY_VENUE_IDS.has(venueId);
}
