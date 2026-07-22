export interface Sport {
  id: number;
  name: string;
  name_zh?: string | null;
  slug: string;
  /** Global display order for sport type lists (lower first). */
  sort_order?: number | null;
}

export interface VenueSport {
  sport_id: number;
  name?: string;
  name_zh?: string | null;
  slug?: string;
  sort_order: number;
}

export interface Pricing {
  type: 'text' | 'image';
  content: string;
  imageUrl?: string;
}

export type OperatingDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface OperatingDay {
  closed: boolean;
  slots: [string, string][];
}

export interface OperatingHoliday {
  mode: 'same_as_sunday' | 'same_as_weekday' | 'custom' | 'closed';
  closed?: boolean;
  slots?: [string, string][];
}

export interface OperatingHours {
  timezone?: string;
  weekly: Record<OperatingDayKey, OperatingDay>;
  public_holiday?: OperatingHoliday;
  note?: string | null;
}

export interface Venue {
  id: number;
  name: string;
  description: string;
  mtrStation: string;
  mtrExit: string;
  walkingDistance: number;
  address: string;
  ceilingHeight: number;
  startingPrice: number;
  pricing: Pricing;
  images: string[];
  amenities: string[];
  whatsapp: string;
  socialLink?: string;
  org_icon?: string;
  sort_order?: number;
  /** For SEO: e.g. ["Pickleball", "Baseball"]. Derived from sport_data or legacy. */
  sport_types?: string[];
  /** Per-sport sort order: slug -> position (for admin). */
  sport_orders?: Record<string, number>;
  /** From API: list of sports this venue supports with sort_order per sport. */
  sport_data?: VenueSport[];
  coordinates: {
    lat: number;
    lng: number;
  };
  admin_password?: string | null;
  /** True when a court admin password exists (password value is never returned by API). */
  has_admin_password?: boolean;
  /** Per-court membership: show description and join link on this venue's detail. */
  membership_enabled?: boolean;
  membership_description?: string | null;
  membership_join_link?: string | null;
  /** Number of courts at this venue (shown as a tag on detail). */
  court_count?: number | null;
  booking_url?: string | null;
  operating_hours?: OperatingHours | null;
  operating_hours_enabled?: boolean;
  /**
   * Optional real review aggregate for schema.org AggregateRating.
   * Only emit when both rating_value and review_count are present and valid — never fabricate.
   */
  rating_value?: number | null;
  review_count?: number | null;
}

export type Language = 'en' | 'zh';
export type AppTab = 'explore' | 'saved' | 'admin';

export interface BlogPostSummary {
  id?: string;
  slug: string;
  title: string;
  summary?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
  synced_at?: string | null;
  updated_at?: string | null;
}

export interface BlogPost extends BlogPostSummary {
  body_html: string;
}
