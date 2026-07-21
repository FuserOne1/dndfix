-- Chronicles RPG: интерактивные кампании, нулевая сессия и структурированные герои.
-- Миграция не удаляет старые таблицы и сообщения.

ALTER TABLE characters ADD COLUMN IF NOT EXISTS rules_data JSONB;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS backstory_data JSONB;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS inventory_data JSONB NOT NULL DEFAULT '{"version":1,"capacity":18,"items":[],"equipped":{},"quickSlots":[null,null,null,null]}'::jsonb;

-- Economy balance v2. Preserve everything a legacy hero earned or spent and
-- add only the difference between the old and new starting purse, once.
UPDATE characters
SET gold = GREATEST(0, gold + CASE rules_data->>'originId'
    WHEN 'wanderer' THEN 12
    WHEN 'noble' THEN 20
    WHEN 'outlaw' THEN 13
    WHEN 'scholar' THEN 12
    WHEN 'soldier' THEN 14
    WHEN 'acolyte' THEN 12
    WHEN 'artisan' THEN 16
    WHEN 'survivor' THEN 12
    ELSE 0
  END),
  rules_data = jsonb_set(rules_data, '{rulesVersion}', '2'::jsonb, true)
WHERE rules_data IS NOT NULL
  AND COALESCE((rules_data->>'rulesVersion')::integer, 1) < 2;

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

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS state_version BIGINT NOT NULL DEFAULT 0;

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

CREATE TABLE IF NOT EXISTS campaign_stash_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  item_data JSONB NOT NULL,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,
  name TEXT NOT NULL,
  stock JSONB NOT NULL DEFAULT '[]'::jsonb,
  buy_modifier NUMERIC NOT NULL DEFAULT 1,
  sell_modifier NUMERIC NOT NULL DEFAULT 0.45,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, merchant_key)
);

CREATE TABLE IF NOT EXISTS campaign_scene_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  scene_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  layout TEXT NOT NULL DEFAULT 'wide' CHECK (layout IN ('wide', 'comic-3')),
  prompt TEXT,
  image_url TEXT,
  storage_path TEXT,
  model TEXT,
  error TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, scene_id)
);

CREATE TABLE IF NOT EXISTS campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  scene_id TEXT,
  choice_id TEXT,
  actor_id TEXT,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, sequence)
);

CREATE TABLE IF NOT EXISTS campaign_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  target_key TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'npc' CHECK (target_type IN ('npc', 'faction')),
  trust INTEGER NOT NULL DEFAULT 0 CHECK (trust BETWEEN -100 AND 100),
  respect INTEGER NOT NULL DEFAULT 0 CHECK (respect BETWEEN -100 AND 100),
  fear INTEGER NOT NULL DEFAULT 0 CHECK (fear BETWEEN -100 AND 100),
  affection INTEGER NOT NULL DEFAULT 0 CHECK (affection BETWEEN -100 AND 100),
  reason TEXT,
  updated_scene_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, target_key)
);

CREATE TABLE IF NOT EXISTS campaign_character_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL,
  condition_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
  expires_at_scene INTEGER,
  source_scene_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, character_id, condition_key)
);

CREATE TABLE IF NOT EXISTS campaign_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  location_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('rumored', 'discovered', 'visited', 'blocked')),
  danger INTEGER NOT NULL DEFAULT 1 CHECK (danger BETWEEN 0 AND 5),
  services JSONB NOT NULL DEFAULT '{"trade":false,"rest":false,"stash":false}'::jsonb,
  discovered_scene_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, location_key)
);

CREATE TABLE IF NOT EXISTS campaign_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  route_key TEXT NOT NULL,
  from_key TEXT NOT NULL,
  to_key TEXT NOT NULL,
  label TEXT NOT NULL,
  danger INTEGER NOT NULL DEFAULT 1 CHECK (danger BETWEEN 0 AND 5),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'blocked', 'unknown')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, route_key)
);

CREATE TABLE IF NOT EXISTS campaign_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  quest_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  stage TEXT NOT NULL DEFAULT 'Начато',
  related_location_key TEXT,
  updated_scene_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, quest_key)
);

CREATE TABLE IF NOT EXISTS campaign_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  clue_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  related_quest_key TEXT,
  reliability TEXT NOT NULL DEFAULT 'uncertain' CHECK (reliability IN ('uncertain', 'likely', 'confirmed')),
  discovered_scene_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, clue_key)
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('scene-images', 'scene-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE INDEX IF NOT EXISTS idx_campaigns_updated ON campaigns(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_scenes_campaign_number ON campaign_scenes(campaign_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_campaign_votes_scene ON campaign_votes(campaign_id, scene_id);
CREATE INDEX IF NOT EXISTS idx_campaign_stash_campaign ON campaign_stash_items(campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_merchants_campaign ON campaign_merchants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_scene_images_campaign_number ON campaign_scene_images(campaign_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_sequence ON campaign_events(campaign_id, sequence DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_events_one_resolution_per_scene ON campaign_events(campaign_id, scene_id) WHERE event_type = 'choice_resolved';
CREATE INDEX IF NOT EXISTS idx_campaign_relationships_campaign ON campaign_relationships(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_conditions_campaign ON campaign_character_conditions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_locations_campaign ON campaign_locations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_routes_campaign ON campaign_routes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_quests_campaign ON campaign_quests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_clues_campaign ON campaign_clues(campaign_id);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_stash_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_scene_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_character_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_clues ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "campaign_stash_items_all" ON campaign_stash_items;
CREATE POLICY "campaign_stash_items_all" ON campaign_stash_items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_merchants_all" ON campaign_merchants;
CREATE POLICY "campaign_merchants_all" ON campaign_merchants FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_scene_images_all" ON campaign_scene_images;
CREATE POLICY "campaign_scene_images_all" ON campaign_scene_images FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_events_all" ON campaign_events;
CREATE POLICY "campaign_events_all" ON campaign_events FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_relationships_all" ON campaign_relationships;
CREATE POLICY "campaign_relationships_all" ON campaign_relationships FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_character_conditions_all" ON campaign_character_conditions;
CREATE POLICY "campaign_character_conditions_all" ON campaign_character_conditions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_locations_all" ON campaign_locations;
CREATE POLICY "campaign_locations_all" ON campaign_locations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_routes_all" ON campaign_routes;
CREATE POLICY "campaign_routes_all" ON campaign_routes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_quests_all" ON campaign_quests;
CREATE POLICY "campaign_quests_all" ON campaign_quests FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_clues_all" ON campaign_clues;
CREATE POLICY "campaign_clues_all" ON campaign_clues FOR ALL USING (true) WITH CHECK (true);

DROP FUNCTION IF EXISTS apply_campaign_world_event(TEXT,BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,JSONB);

CREATE OR REPLACE FUNCTION apply_campaign_world_event(
  p_campaign_id TEXT,
  p_expected_version BIGINT,
  p_event_type TEXT,
  p_scene_id TEXT,
  p_choice_id TEXT,
  p_actor_id TEXT,
  p_summary TEXT,
  p_patch JSONB,
  p_systems JSONB,
  p_state JSONB,
  p_current_scene JSONB
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version BIGINT;
  v_next BIGINT;
  v_scene_number INTEGER;
  item JSONB;
  v_key TEXT;
BEGIN
  SELECT state_version, COALESCE((state->>'sceneNumber')::int, 0) INTO v_version, v_scene_number FROM campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF v_version <> p_expected_version THEN RAISE EXCEPTION 'campaign_version_conflict:%:%', p_expected_version, v_version; END IF;
  v_next := v_version + 1;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_patch->'relationships', '[]'::jsonb)) LOOP
    v_key := COALESCE(NULLIF(item->>'targetKey',''), NULLIF(item->>'target_key',''), lower(regexp_replace(item->>'targetName', '[^[:alnum:]]+', '-', 'g')));
    INSERT INTO campaign_relationships(campaign_id,target_key,target_name,target_type,trust,respect,fear,affection,reason,updated_scene_id)
    VALUES(p_campaign_id,v_key,item->>'targetName',COALESCE(item->>'targetType','npc'),LEAST(25,GREATEST(-25,COALESCE((item->>'trust')::int,0))),LEAST(25,GREATEST(-25,COALESCE((item->>'respect')::int,0))),LEAST(25,GREATEST(-25,COALESCE((item->>'fear')::int,0))),LEAST(25,GREATEST(-25,COALESCE((item->>'affection')::int,0))),item->>'reason',p_scene_id)
    ON CONFLICT(campaign_id,target_key) DO UPDATE SET target_name=EXCLUDED.target_name,target_type=EXCLUDED.target_type,trust=LEAST(100,GREATEST(-100,campaign_relationships.trust+EXCLUDED.trust)),respect=LEAST(100,GREATEST(-100,campaign_relationships.respect+EXCLUDED.respect)),fear=LEAST(100,GREATEST(-100,campaign_relationships.fear+EXCLUDED.fear)),affection=LEAST(100,GREATEST(-100,campaign_relationships.affection+EXCLUDED.affection)),reason=EXCLUDED.reason,updated_scene_id=EXCLUDED.updated_scene_id,updated_at=NOW();
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_patch->'conditions', '[]'::jsonb)) LOOP
    IF item->>'action' = 'remove' THEN
      DELETE FROM campaign_character_conditions WHERE campaign_id=p_campaign_id AND character_id=item->>'characterId' AND condition_key=item->>'key';
    ELSE
      INSERT INTO campaign_character_conditions(campaign_id,character_id,condition_key,name,description,severity,expires_at_scene,source_scene_id)
      VALUES(p_campaign_id,item->>'characterId',item->>'key',item->>'name',COALESCE(item->>'description',''),COALESCE(item->>'severity','minor'),CASE WHEN COALESCE((item->>'durationScenes')::int,0) > 0 THEN v_scene_number + (item->>'durationScenes')::int ELSE NULL END,p_scene_id)
      ON CONFLICT(campaign_id,character_id,condition_key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,severity=EXCLUDED.severity,expires_at_scene=EXCLUDED.expires_at_scene,source_scene_id=EXCLUDED.source_scene_id,updated_at=NOW();
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_patch->'locations', '[]'::jsonb)) LOOP
    v_key := COALESCE(NULLIF(item->>'key',''), lower(regexp_replace(item->>'name', '[^[:alnum:]]+', '-', 'g')));
    INSERT INTO campaign_locations(campaign_id,location_key,name,description,status,danger,services,discovered_scene_id)
    VALUES(p_campaign_id,v_key,item->>'name',COALESCE(item->>'description',''),COALESCE(item->>'status','discovered'),LEAST(5,GREATEST(0,COALESCE((item->>'danger')::int,1))),COALESCE(item->'services','{"trade":false,"rest":false,"stash":false}'::jsonb),p_scene_id)
    ON CONFLICT(campaign_id,location_key) DO UPDATE SET name=EXCLUDED.name,description=CASE WHEN EXCLUDED.description='' THEN campaign_locations.description ELSE EXCLUDED.description END,status=EXCLUDED.status,danger=EXCLUDED.danger,services=EXCLUDED.services,updated_at=NOW();
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_patch->'routes', '[]'::jsonb)) LOOP
    v_key := COALESCE(NULLIF(item->>'key',''), 'route:'||(item->>'fromKey')||':'||(item->>'toKey'));
    INSERT INTO campaign_routes(campaign_id,route_key,from_key,to_key,label,danger,status)
    VALUES(p_campaign_id,v_key,item->>'fromKey',item->>'toKey',COALESCE(item->>'label','Маршрут'),LEAST(5,GREATEST(0,COALESCE((item->>'danger')::int,1))),COALESCE(item->>'status','open'))
    ON CONFLICT(campaign_id,route_key) DO UPDATE SET label=EXCLUDED.label,danger=EXCLUDED.danger,status=EXCLUDED.status,updated_at=NOW();
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_patch->'quests', '[]'::jsonb)) LOOP
    INSERT INTO campaign_quests(campaign_id,quest_key,title,description,status,stage,related_location_key,updated_scene_id)
    VALUES(p_campaign_id,item->>'key',item->>'title',COALESCE(item->>'description',''),COALESCE(item->>'status','active'),COALESCE(item->>'stage','Начато'),item->>'relatedLocationKey',p_scene_id)
    ON CONFLICT(campaign_id,quest_key) DO UPDATE SET title=EXCLUDED.title,description=CASE WHEN EXCLUDED.description='' THEN campaign_quests.description ELSE EXCLUDED.description END,status=EXCLUDED.status,stage=EXCLUDED.stage,related_location_key=COALESCE(EXCLUDED.related_location_key,campaign_quests.related_location_key),updated_scene_id=EXCLUDED.updated_scene_id,updated_at=NOW();
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_patch->'clues', '[]'::jsonb)) LOOP
    INSERT INTO campaign_clues(campaign_id,clue_key,title,description,related_quest_key,reliability,discovered_scene_id)
    VALUES(p_campaign_id,item->>'key',item->>'title',item->>'description',item->>'relatedQuestKey',COALESCE(item->>'reliability','uncertain'),p_scene_id)
    ON CONFLICT(campaign_id,clue_key) DO NOTHING;
  END LOOP;

  DELETE FROM campaign_character_conditions WHERE campaign_id=p_campaign_id AND expires_at_scene IS NOT NULL AND expires_at_scene <= v_scene_number + 1;

  UPDATE campaigns SET state_version=v_next,state=jsonb_set(jsonb_set(COALESCE(p_state,state,'{}'::jsonb),'{version}',to_jsonb(v_next),true),'{systems}',COALESCE(p_systems,'{}'::jsonb),true),current_scene=COALESCE(p_current_scene,current_scene),updated_at=NOW() WHERE id=p_campaign_id;
  IF p_current_scene IS NOT NULL THEN
    INSERT INTO campaign_scenes(campaign_id,scene_id,act_id,scene_number,content)
    VALUES(p_campaign_id,p_current_scene->>'id',p_current_scene->>'actId',COALESCE((p_state->>'sceneNumber')::int,1),p_current_scene)
    ON CONFLICT(campaign_id,scene_id) DO UPDATE SET act_id=EXCLUDED.act_id,scene_number=EXCLUDED.scene_number,content=EXCLUDED.content;
  END IF;
  INSERT INTO campaign_events(campaign_id,sequence,event_type,scene_id,choice_id,actor_id,summary,payload) VALUES(p_campaign_id,v_next,p_event_type,p_scene_id,p_choice_id,p_actor_id,p_summary,COALESCE(p_patch,'{}'::jsonb));
  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_campaign_world_event(TEXT,BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,JSONB,JSONB,JSONB) TO anon, authenticated;

DROP POLICY IF EXISTS "scene_images_public_read" ON storage.objects;
CREATE POLICY "scene_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'scene-images');
DROP POLICY IF EXISTS "scene_images_public_insert" ON storage.objects;
CREATE POLICY "scene_images_public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'scene-images');
DROP POLICY IF EXISTS "scene_images_public_update" ON storage.objects;
CREATE POLICY "scene_images_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'scene-images') WITH CHECK (bucket_id = 'scene-images');
DROP POLICY IF EXISTS "scene_images_public_delete" ON storage.objects;
CREATE POLICY "scene_images_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'scene-images');

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_stash_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_merchants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_scene_images;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['campaign_events','campaign_relationships','campaign_character_conditions','campaign_locations','campaign_routes','campaign_quests','campaign_clues'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Force PostgREST to see newly added columns immediately.
NOTIFY pgrst, 'reload schema';
