-- Sirf ye SQL Supabase me run karo (SQL Editor)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  poster_url TEXT,
  match_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stream_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  stream_url TEXT,
  is_live BOOLEAN DEFAULT FALSE,
  current_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO stream_config (id, stream_url, is_live)
VALUES (1, NULL, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  telegram_link TEXT DEFAULT 'https://t.me/',
  admin_pass TEXT DEFAULT 'admin123',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (id, telegram_link, admin_pass)
VALUES (1, 'https://t.me/', 'admin123')
ON CONFLICT (id) DO NOTHING;

-- Public read + write (simple version - admin password se protect)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all matches" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all stream" ON stream_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all settings" ON site_settings FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE stream_config;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE site_settings;
