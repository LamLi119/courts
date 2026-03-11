-- Per-court membership: each venue can have its own membership description and join link.
-- Run once on your MySQL database.

ALTER TABLE venues ADD COLUMN membership_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE venues ADD COLUMN membership_description TEXT;
ALTER TABLE venues ADD COLUMN membership_join_link VARCHAR(2048);
