-- Global display order for sport types (filter tabs, admin, hero).
-- Safe to run once; skip if column already exists.
ALTER TABLE sports
  ADD COLUMN sort_order INT NULL DEFAULT NULL
  COMMENT 'Display order for sport type lists (lower first)'
  AFTER slug;

UPDATE sports SET sort_order = id WHERE sort_order IS NULL;
