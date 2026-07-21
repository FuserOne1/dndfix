-- Chronicles RPG v2: permanent personalized stories, replay timelines and savepoints.
-- Safe to run repeatedly. Existing campaigns become timeline #1 of their own story.

CREATE TABLE IF NOT EXISTS campaign_stories (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  bible JSONB NOT NULL,
  opening_scene JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS story_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timeline_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS parent_campaign_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ending_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ending_title TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

INSERT INTO campaign_stories(id, owner_user_id, title, preferences, bible, opening_scene, created_at, updated_at)
SELECT c.id, c.host_user_id, COALESCE(c.title, c.bible->>'title', 'Безымянная история'), c.preferences, c.bible,
  COALESCE(first_scene.content, c.current_scene), c.created_at, c.updated_at
FROM campaigns c
LEFT JOIN LATERAL (
  SELECT content FROM campaign_scenes s WHERE s.campaign_id = c.id ORDER BY s.scene_number ASC LIMIT 1
) first_scene ON TRUE
WHERE c.bible IS NOT NULL AND c.current_scene IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE campaigns SET story_id = id WHERE story_id IS NULL AND bible IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE campaigns ADD CONSTRAINT campaigns_story_id_fkey FOREIGN KEY (story_id) REFERENCES campaign_stories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE campaigns ADD CONSTRAINT campaigns_parent_campaign_id_fkey FOREIGN KEY (parent_campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS campaign_savepoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id TEXT NOT NULL REFERENCES campaign_stories(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'branch' CHECK (kind IN ('branch', 'manual', 'ending')),
  scene_id TEXT NOT NULL,
  scene_number INTEGER NOT NULL,
  state JSONB NOT NULL,
  current_scene JSONB NOT NULL,
  character_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_savepoints_branch ON campaign_savepoints(campaign_id, scene_id, kind) WHERE kind IN ('branch', 'ending');
CREATE INDEX IF NOT EXISTS idx_campaign_savepoints_story ON campaign_savepoints(story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_story_timeline ON campaigns(story_id, timeline_number DESC);

ALTER TABLE campaign_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_savepoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_stories_all" ON campaign_stories;
CREATE POLICY "campaign_stories_all" ON campaign_stories FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_savepoints_all" ON campaign_savepoints;
CREATE POLICY "campaign_savepoints_all" ON campaign_savepoints FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
