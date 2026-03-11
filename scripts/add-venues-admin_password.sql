-- Court admin password: same password on multiple venues = one admin can edit all of them.
-- Run once on your MySQL database.
ALTER TABLE venues ADD COLUMN admin_password VARCHAR(255) DEFAULT NULL;
