import { supabase } from '../lib/supabase';
import type { CampaignEvent, CampaignState, CampaignSystemsState, StoryScene, WorldStatePatch } from './types';

interface CommitWorldEventInput {
  campaignId: string;
  expectedVersion: number;
  eventType: string;
  sceneId: string;
  choiceId?: string;
  actorId?: string;
  summary: string;
  patch: WorldStatePatch;
  systems: CampaignSystemsState;
  campaignState?: CampaignState;
  currentScene?: StoryScene;
}

export async function commitWorldEvent(input: CommitWorldEventInput): Promise<number> {
  const { data, error } = await supabase.rpc('apply_campaign_world_event', {
    p_campaign_id: input.campaignId,
    p_expected_version: input.expectedVersion,
    p_event_type: input.eventType,
    p_scene_id: input.sceneId,
    p_choice_id: input.choiceId || null,
    p_actor_id: input.actorId || null,
    p_summary: input.summary,
    p_patch: input.patch,
    p_systems: input.systems,
    p_state: input.campaignState || null,
    p_current_scene: input.currentScene || null,
  });
  if (error) {
    if (/campaign_version_conflict/i.test(error.message)) throw new Error('Состояние кампании уже изменилось на другом устройстве. Обновите сцену и повторите выбор.');
    if (/apply_campaign_world_event|schema cache|function/i.test(error.message)) throw new Error(`Системный журнал ещё не установлен в БД. Повторно выполните migration_interactive_rpg_v1.sql. ${error.message}`);
    throw new Error(`Не удалось сохранить последствия выбора: ${error.message}`);
  }
  return Number(data);
}

export async function loadCampaignEvents(campaignId: string, limit = 100): Promise<CampaignEvent[]> {
  const { data, error } = await supabase.from('campaign_events').select('id, sequence, event_type, scene_id, choice_id, actor_id, summary, payload, created_at').eq('campaign_id', campaignId).order('sequence', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).map((row: any) => ({ id: row.id, sequence: row.sequence, eventType: row.event_type, sceneId: row.scene_id || undefined, choiceId: row.choice_id || undefined, actorId: row.actor_id || undefined, summary: row.summary, payload: row.payload || {}, createdAt: row.created_at }));
}

export function bootstrapPatch(systems: CampaignSystemsState): WorldStatePatch {
  return {
    relationships: systems.relationships.map(item => ({ targetKey: item.targetKey, targetName: item.targetName, targetType: item.targetType, trust: item.trust, respect: item.respect, fear: item.fear, affection: item.affection, reason: item.reason || 'Начальное состояние' })),
    conditions: systems.conditions.map(item => ({ characterId: item.characterId, key: item.key, name: item.name, description: item.description, severity: item.severity, action: 'add' as const, durationScenes: item.expiresAtScene })),
    locations: systems.locations,
    routes: systems.routes,
    quests: systems.quests,
    clues: systems.clues,
  };
}
