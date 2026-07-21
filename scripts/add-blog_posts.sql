-- Blog posts synced from Notion (run once on courts-db / staging).
CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR(36) PRIMARY KEY COMMENT 'Notion page id',
  slug VARCHAR(191) NOT NULL UNIQUE,
  title VARCHAR(512) NOT NULL,
  summary TEXT,
  cover_url VARCHAR(1024),
  body_html MEDIUMTEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Published',
  published_at DATETIME NULL,
  notion_last_edited DATETIME NULL,
  synced_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blog_published (status, published_at)
);
