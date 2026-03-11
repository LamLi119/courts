-- Add court count to venues (number of courts at this venue).
-- Run once on your MySQL database.

ALTER TABLE venues ADD COLUMN court_count INT NULL;
