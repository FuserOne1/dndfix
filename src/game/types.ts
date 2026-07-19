export type AttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export type GameMode = 'solo' | 'party';
export type CampaignLength = 'short' | 'medium' | 'long';
export type CampaignTone = 'heroic' | 'dark' | 'mystery' | 'adventure' | 'horror' | 'comedy';
export type CombatFrequency = 'rare' | 'balanced' | 'frequent';
export type CampaignStatus = 'setup' | 'generating' | 'playing' | 'finished';

export interface RuleTrait {
  id: string;
  name: string;
  description: string;
}

export interface LineageDefinition {
  id: string;
  name: string;
  icon: string;
  summary: string;
  attributeBonuses: Partial<Record<AttributeKey, number>>;
  speed: number;
  traits: RuleTrait[];
  storyTags: string[];
}

export interface ClassDefinition {
  id: string;
  name: string;
  icon: string;
  summary: string;
  hitDie: number;
  primaryAttributes: AttributeKey[];
  savingThrows: AttributeKey[];
  skillChoices: number;
  availableSkills: string[];
  startingEquipment: string[];
  traits: RuleTrait[];
  storyTags: string[];
}

export interface OriginDefinition {
  id: string;
  name: string;
  icon: string;
  summary: string;
  skills: string[];
  equipment: string[];
  gold: number;
  storyTags: string[];
}

export interface BackstoryData {
  homeland: string;
  goal: string;
  loss: string;
  connection: string;
  fear: string;
  secret: string;
  values: string[];
  hooks: string[];
  prose: string;
}

export interface CharacterRulesData {
  rulesVersion: 1;
  lineageId: string;
  classId: string;
  originId: string;
  selectedSkills: string[];
  traits: string[];
  storyTags: string[];
}

export interface CampaignPreferences {
  mode: GameMode;
  length: CampaignLength;
  tones: CampaignTone[];
  setting: string;
  premise: string;
  combatFrequency: CombatFrequency;
  difficulty: 'story' | 'normal' | 'dangerous';
  branching: 'focused' | 'balanced' | 'wide';
  themes: string;
  boundaries: string;
  customWish: string;
  hideLockedChoices: boolean;
  voteTimerSeconds: number | null;
}

export interface CampaignBible {
  title: string;
  tagline: string;
  premise: string;
  setting: string;
  tone: string[];
  centralConflict: string;
  antagonist: { name: string; role: string; motive: string };
  keyNpcs: Array<{ id: string; name: string; role: string; motive: string; secret: string }>;
  acts: Array<{ id: string; title: string; goal: string; turningPoint: string; sceneSeeds: string[] }>;
  truths: string[];
  endings: Array<{ id: string; title: string; condition: string }>;
  characterHooks: Array<{ characterName: string; hook: string; relatedNpc?: string }>;
}

export type ChoiceCheck = {
  attribute: AttributeKey;
  difficulty: number;
  skill?: string;
};

export interface StoryChoice {
  id: string;
  label: string;
  description?: string;
  intent: string;
  check?: ChoiceCheck;
  requirements?: {
    classIds?: string[];
    lineageIds?: string[];
    items?: string[];
    flags?: string[];
    minAttribute?: Partial<Record<AttributeKey, number>>;
  };
  consequences: {
    successFlags?: string[];
    failureFlags?: string[];
    removeItems?: string[];
    grantItems?: string[];
    hpChange?: number;
    startsBattle?: boolean;
    battle?: import('../types').BattleStartData;
  };
}

export interface StoryScene {
  id: string;
  actId: string;
  title: string;
  location: string;
  body: string[];
  type: 'group' | 'personal' | 'check' | 'battle' | 'rest' | 'ending';
  focusCharacter?: string;
  choices: StoryChoice[];
  recap?: string;
}

export interface CampaignState {
  flags: string[];
  inventory: string[];
  relationships: Record<string, number>;
  completedSceneIds: string[];
  currentActId: string;
  currentSceneId: string;
  sceneNumber: number;
}

export interface ChoiceResolution {
  choiceId: string;
  success: boolean;
  roll?: number;
  total?: number;
  difficulty?: number;
  summary: string;
  gainedItems: string[];
  lostItems: string[];
  hpChange: number;
}

export interface CampaignRuntime {
  id: string;
  mode: GameMode;
  status: CampaignStatus;
  hostUserId: string;
  preferences: CampaignPreferences;
  bible: CampaignBible;
  state: CampaignState;
  currentScene: StoryScene;
}
