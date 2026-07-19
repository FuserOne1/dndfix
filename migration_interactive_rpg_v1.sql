-- Chronicles RPG: интерактивные кампании, нулевая сессия и структурированные герои.
-- Миграция не удаляет старые таблицы и сообщения.

ALTER TABLE characters ADD COLUMN IF NOT EXISTS rules_data JSONB;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS backstory_data JSONB;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gold INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'party')),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'generating', 'playing', 'finished')),
  host_user_id TEXT NOT NULL,
  title TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  bible JSONB,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_scene JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_session_id TEXT NOT NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  character_snapshot JSONB NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, user_session_id)
);

-- A campaign owns an immutable character snapshot. Deleting a reusable hero
-- from the library must not delete or block an existing campaign.
ALTER TABLE campaign_participants ALTER COLUMN character_id DROP NOT NULL;
ALTER TABLE campaign_participants DROP CONSTRAINT IF EXISTS campaign_participants_character_id_fkey;
ALTER TABLE campaign_participants
  ADD CONSTRAINT campaign_participants_character_id_fkey
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS campaign_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  act_id TEXT NOT NULL,
  scene_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, scene_id)
);

CREATE TABLE IF NOT EXISTS campaign_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  user_session_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, scene_id, user_session_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_updated ON campaigns(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_scenes_campaign_number ON campaign_scenes(campaign_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_campaign_votes_scene ON campaign_votes(campaign_id, scene_id);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_votes ENABLE ROW LEVEL SECURITY;

-- Текущая версия использует анонимные локальные идентификаторы участников.
-- Политики намеренно повторяют существующую открытую модель приложения.
DROP POLICY IF EXISTS "campaigns_read" ON campaigns;
CREATE POLICY "campaigns_read" ON campaigns FOR SELECT USING (true);
DROP POLICY IF EXISTS "campaigns_insert" ON campaigns;
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "campaigns_update" ON campaigns;
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaigns_delete" ON campaigns;
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE USING (true);

DROP POLICY IF EXISTS "campaign_participants_all" ON campaign_participants;
CREATE POLICY "campaign_participants_all" ON campaign_participants FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_scenes_all" ON campaign_scenes;
CREATE POLICY "campaign_scenes_all" ON campaign_scenes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_votes_all" ON campaign_votes;
CREATE POLICY "campaign_votes_all" ON campaign_votes FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_votes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Force PostgREST to see newly added columns immediately.
NOTIFY pgrst, 'reload schema';
