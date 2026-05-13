-- Links a Courts venue to a The Grind organization for upcoming public events.
-- Run once on your Cloud SQL / MySQL instance (adjust if your DB name differs).
ALTER TABLE venues
  ADD COLUMN grind_company_id INT NULL DEFAULT NULL
  COMMENT 'The Grind companysNonOdoo company id for /web/v2/{id}/events/upcoming/public'
  AFTER court_count;
