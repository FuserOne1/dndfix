import { CampaignBible, CampaignRuntime, CampaignSavepoint, StoryScene } from './types';

export interface EndingIdentity {
  id: string;
  title: string;
}

export function storyIdOf(campaign: Pick<CampaignRuntime, 'id' | 'storyId'>): string {
  return campaign.storyId || campaign.id;
}

export function timelineNumberOf(campaign: Pick<CampaignRuntime, 'timelineNumber'>): number {
  return Math.max(1, campaign.timelineNumber || 1);
}

export function identifyEnding(bible: CampaignBible, scene: StoryScene): EndingIdentity {
  const sceneTitle = normalize(scene.title);
  const exact = bible.endings.find(ending => ending.id === scene.id || ending.id === scene.blueprintId);
  const byTitle = bible.endings.find(ending => {
    const endingTitle = normalize(ending.title);
    return endingTitle.length > 3 && (sceneTitle.includes(endingTitle) || endingTitle.includes(sceneTitle));
  });
  const match = exact || byTitle || (bible.endings.length === 1 ? bible.endings[0] : undefined);
  return match ? { id: match.id, title: match.title } : { id: scene.blueprintId || scene.id, title: scene.title };
}

export function savepointLabel(campaign: CampaignRuntime): string {
  const act = campaign.bible.acts.find(item => item.id === campaign.state.currentActId);
  return `${act?.title || 'Хроника'} · перед сценой ${campaign.state.sceneNumber}`;
}

export function groupTimelines(campaigns: CampaignRuntime[]): Array<{ storyId: string; title: string; timelines: CampaignRuntime[] }> {
  const groups = new Map<string, CampaignRuntime[]>();
  for (const campaign of campaigns) {
    const storyId = storyIdOf(campaign);
    groups.set(storyId, [...(groups.get(storyId) || []), campaign]);
  }
  return [...groups.entries()].map(([storyId, timelines]) => ({
    storyId,
    title: timelines[0]?.bible.title || 'Безымянная история',
    timelines: [...timelines].sort((left, right) => timelineNumberOf(right) - timelineNumberOf(left)),
  }));
}

export function rowToSavepoint(row: any): CampaignSavepoint {
  return {
    id: row.id,
    storyId: row.story_id,
    campaignId: row.campaign_id,
    label: row.label,
    kind: row.kind,
    sceneId: row.scene_id,
    sceneNumber: row.scene_number,
    state: row.state,
    currentScene: row.current_scene,
    characterSnapshots: row.character_snapshots || [],
    createdAt: row.created_at,
  };
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('ru').replace(/[^а-яёa-z0-9]+/gi, ' ').trim();
}
