-- Add booking URL and operating hours to venues.
-- Run once on your MySQL database.

ALTER TABLE venues ADD COLUMN booking_url VARCHAR(2048) NULL;
ALTER TABLE venues ADD COLUMN operating_hours JSON NULL;
