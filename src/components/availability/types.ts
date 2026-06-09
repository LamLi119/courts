export interface AvailabilitySlot {
  start: string;
  end: string;
  startIso?: string;
  endIso?: string;
}

export interface AvailabilityCourt {
  courtId: number;
  courtName: string;
  slots: AvailabilitySlot[];
}

export interface VenueAvailabilityResponse {
  supported: boolean;
  date: string;
  timezone?: string;
  provider?: string;
  courts: AvailabilityCourt[];
  error?: string;
}
