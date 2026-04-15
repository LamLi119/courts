-- Toggle visibility of operating hours on venue detail page.
-- Run once on your MySQL database.

ALTER TABLE venues ADD COLUMN operating_hours_enabled TINYINT(1) NOT NULL DEFAULT 1;
