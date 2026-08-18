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
CREATE UNIQUE INDEX IF NOT EXISTS idx_filename ON wallpapers(filename);
CREATE INDEX IF NOT EXISTS idx_wallpapers_feed ON wallpapers(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallpapers_active_cat ON wallpapers(is_active, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallpapers_blurhash ON wallpapers(blurhash);

CREATE TABLE IF NOT EXISTS wallpaper_tags (
    wallpaper_id   TEXT NOT NULL REFERENCES wallpapers(id) ON DELETE CASCADE,
    tag            TEXT NOT NULL,
    original_label TEXT NOT NULL,
    confidence     REAL NOT NULL,
    PRIMARY KEY (wallpaper_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_wallpaper_tags_wallpaper ON wallpaper_tags(wallpaper_id);
CREATE INDEX IF NOT EXISTS idx_wallpaper_tags_tag ON wallpaper_tags(tag);

CREATE TABLE IF NOT EXISTS wallpaper_categories (
    wallpaper_id  TEXT NOT NULL REFERENCES wallpapers(id) ON DELETE CASCADE,
    category      TEXT NOT NULL,
    is_primary    INTEGER NOT NULL DEFAULT 0,
    category_score REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (wallpaper_id, category)
);

CREATE INDEX IF NOT EXISTS idx_wallpaper_categories_wallpaper ON wallpaper_categories(wallpaper_id);
CREATE INDEX IF NOT EXISTS idx_wallpaper_categories_category ON wallpaper_categories(category);
