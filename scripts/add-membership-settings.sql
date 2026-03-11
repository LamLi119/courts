-- Membership (Option A): single-row app settings for super admin.
-- Run once on your MySQL database.

CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  membership_enabled TINYINT(1) NOT NULL DEFAULT 0,
  membership_description TEXT,
  membership_join_link VARCHAR(2048)
);

INSERT INTO app_settings (id, membership_enabled, membership_description, membership_join_link)
VALUES (1, 0, NULL, NULL)
ON DUPLICATE KEY UPDATE id = id;
