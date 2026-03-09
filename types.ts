export interface Sport {
  id: number;
  name: string;
  name_zh?: string | null;
  slug: string;
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
  /** Per-court membership: show description and join link on this venue's detail. */
  membership_enabled?: boolean;
  membership_description?: string | null;
  membership_join_link?: string | null;
  /** Number of courts at this venue (shown as a tag on detail). */
  court_count?: number | null;
}

export type Language = 'en' | 'zh';
export type AppTab = 'explore' | 'saved' | 'admin';
