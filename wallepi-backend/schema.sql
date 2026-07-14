CREATE TABLE IF NOT EXISTS wallpapers (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    r2_key_full  TEXT NOT NULL,
    r2_key_thumb TEXT NOT NULL,
    width       INTEGER NOT NULL,
    height      INTEGER NOT NULL,
    file_size   INTEGER NOT NULL,
    mime_type   TEXT NOT NULL DEFAULT 'image/jpeg',
    category    TEXT NOT NULL DEFAULT 'uncategorized',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_active     ON wallpapers(is_active);
CREATE INDEX IF NOT EXISTS idx_created_at ON wallpapers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_category   ON wallpapers(category);

