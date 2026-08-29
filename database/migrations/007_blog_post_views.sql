CREATE TABLE IF NOT EXISTS blog_post_view (
  slug TEXT PRIMARY KEY,
  view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE blog_post_view IS
  'Persistent page-view totals for blog posts, migrated from data/views.db.';
