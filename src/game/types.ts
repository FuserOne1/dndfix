export type AttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export type GameMode = 'solo' | 'party';
export type CampaignLength = 'short' | 'medium' | 'long';
export type CampaignTone = 'heroic' | 'dark' | 'mystery' | 'adventure' | 'horror' | 'comedy';
export type CombatFrequency = 'rare' | 'balanced' | 'frequent';
export type CampaignStatus = 'setup' | 'generating' | 'playing' | 'finished';
export type IllustrationMode = 'off' | 'important' | 'all';
export type ArtStyle = 'dark-comic' | 'classic-fantasy' | 'graphic-novel' | 'watercolor' | 'anime';

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

export type ItemType = 'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable' | 'tool' | 'quest' | 'misc';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';
export type EquipmentSlot = 'mainHand' | 'offHand' | 'armor' | 'accessory1' | 'accessory2';

export interface InventoryItemEffect {
  heal?: number;
  tempHp?: number;
  damage?: number;
  damageDice?: string;
  buffAc?: number;
  buffAtk?: number;
  buffDmg?: number;
  condition?: string;
  description?: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  icon: string;
  value: number;
  slots: number;
  stackLimit: number;
  equipSlots?: EquipmentSlot[];
  weaponDice?: string;
  armorClass?: number;
  effect?: InventoryItemEffect;
  storyTags: string[];
}

export interface InventoryItem {
  uid: string;
  templateId: string;
  name: string;
  quantity: number;
  customDescription?: string;
}

export interface InventoryData {
  version: 1;
  capacity: number;
  items: InventoryItem[];
  equipped: Partial<Record<EquipmentSlot, string>>;
  quickSlots: Array<string | null>;
}

export interface MerchantStockItem {
  templateId: string;
  quantity: number;
  priceModifier: number;
}

export interface MerchantData {
  key: string;
  name: string;
  stock: MerchantStockItem[];
  buyModifier: number;
  sellModifier: number;
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
  rulesVersion: 1 | 2;
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
  illustrationMode?: IllustrationMode;
  artStyle?: ArtStyle;
}

export type SceneType =
  | 'narrative'
  | 'social'
  | 'exploration'
  | 'investigation'
  | 'challenge'
  | 'combat'
  | 'travel'
  | 'camp'
  | 'rest'
  | 'trade'
  | 'loot'
  | 'personal'
  | 'discovery'
  | 'climax'
  | 'ending';

export type LegacySceneType = 'group' | 'check' | 'battle';
export type SceneAudience = 'group' | 'personal' | 'solo';

export interface SceneServices {
  trade: boolean;
  rest: boolean;
  stash: boolean;
}

export interface SceneBlueprint {
  id: string;
  actId: string;
  type: SceneType;
  purpose: string;
  tension: 1 | 2 | 3 | 4 | 5;
  audience: SceneAudience;
  focusCharacter?: string;
  services: SceneServices;
  requiredFlags?: string[];
  forbiddenFlags?: string[];
}

export interface SceneDirectorState {
  currentBlueprintId?: string;
  completedBlueprintIds: string[];
  recentTypes: SceneType[];
  scenesSinceCombat: number;
  scenesSinceRest: number;
  scenesSinceTrade: number;
  personalSceneCounts: Record<string, number>;
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
  playerPromises?: Array<{ id: string; source: 'premise' | 'wish' | 'theme' | 'character'; text: string; characterName?: string }>;
  scenePlan?: SceneBlueprint[];
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
    successGold?: number;
    failureGold?: number;
    startsBattle?: boolean;
    battle?: import('../types').BattleStartData;
    world?: WorldStatePatch;
  };
}

export type RelationshipTargetType = 'npc' | 'faction';
export type LocationStatus = 'rumored' | 'discovered' | 'visited' | 'blocked';
export type QuestStatus = 'active' | 'completed' | 'failed';

export interface CampaignRelationship {
  targetKey: string;
  targetName: string;
  targetType: RelationshipTargetType;
  trust: number;
  respect: number;
  fear: number;
  affection: number;
  reason?: string;
  updatedSceneId?: string;
}

export interface CharacterCondition {
  characterId: string;
  key: string;
  name: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  expiresAtScene?: number;
  sourceSceneId?: string;
}

export interface CampaignLocation {
  key: string;
  name: string;
  description: string;
  status: LocationStatus;
  danger: 0 | 1 | 2 | 3 | 4 | 5;
  services: SceneServices;
  discoveredSceneId?: string;
}

export interface CampaignRoute {
  key: string;
  fromKey: string;
  toKey: string;
  label: string;
  danger: 0 | 1 | 2 | 3 | 4 | 5;
  status: 'open' | 'blocked' | 'unknown';
}

export interface CampaignQuest {
  key: string;
  title: string;
  description: string;
  status: QuestStatus;
  stage: string;
  relatedLocationKey?: string;
  updatedSceneId?: string;
}

export interface CampaignClue {
  key: string;
  title: string;
  description: string;
  relatedQuestKey?: string;
  reliability: 'uncertain' | 'likely' | 'confirmed';
  discoveredSceneId?: string;
}

export interface CampaignSystemsState {
  relationships: CampaignRelationship[];
  conditions: CharacterCondition[];
  locations: CampaignLocation[];
  routes: CampaignRoute[];
  quests: CampaignQuest[];
  clues: CampaignClue[];
}

export interface WorldStatePatch {
  relationships?: Array<Partial<Pick<CampaignRelationship, 'targetKey' | 'targetType'>> & Pick<CampaignRelationship, 'targetName'> & { trust?: number; respect?: number; fear?: number; affection?: number; reason: string }>;
  conditions?: Array<Pick<CharacterCondition, 'characterId' | 'key' | 'name' | 'description' | 'severity'> & { action: 'add' | 'remove'; durationScenes?: number }>;
  locations?: Array<Pick<CampaignLocation, 'key' | 'name'> & Partial<Pick<CampaignLocation, 'description' | 'status' | 'danger' | 'services'>>>;
  routes?: Array<Pick<CampaignRoute, 'fromKey' | 'toKey'> & Partial<Pick<CampaignRoute, 'key' | 'label' | 'danger' | 'status'>>>;
  quests?: Array<Pick<CampaignQuest, 'key' | 'title'> & Partial<Pick<CampaignQuest, 'description' | 'status' | 'stage' | 'relatedLocationKey'>>>;
  clues?: Array<Pick<CampaignClue, 'key' | 'title' | 'description'> & Partial<Pick<CampaignClue, 'relatedQuestKey' | 'reliability'>>>;
}

export interface CampaignEvent {
  id?: string;
  sequence: number;
  eventType: string;
  sceneId?: string;
  choiceId?: string;
  actorId?: string;
  summary: string;
  payload: WorldStatePatch;
  createdAt?: string;
}

export interface StoryScene {
  id: string;
  actId: string;
  title: string;
  location: string;
  body: string[];
  type: SceneType | LegacySceneType;
  audience?: SceneAudience;
  purpose?: string;
  tension?: 1 | 2 | 3 | 4 | 5;
  services?: SceneServices;
  blueprintId?: string;
  focusCharacter?: string;
  choices: StoryChoice[];
  recap?: string;
}

export type SceneImageLayout = 'wide' | 'comic-3';
export type SceneImageStatus = 'pending' | 'ready' | 'failed';

export interface SceneImage {
  id?: string;
  campaignId: string;
  sceneId: string;
  sceneNumber: number;
  status: SceneImageStatus;
  layout: SceneImageLayout;
  prompt?: string;
  imageUrl?: string;
  storagePath?: string;
  model?: string;
  error?: string;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CampaignState {
  version?: number;
  flags: string[];
  inventory: string[];
  relationships: Record<string, number>;
  completedSceneIds: string[];
  currentActId: string;
  currentSceneId: string;
  sceneNumber: number;
  checkFailureStreak?: number;
  director?: SceneDirectorState;
  systems?: CampaignSystemsState;
}

export interface ChoiceResolution {
  choiceId: string;
  success: boolean;
  roll?: number;
  total?: number;
  difficulty?: number;
  attribute?: AttributeKey;
  attributeModifier?: number;
  skill?: string;
  proficiencyBonus?: number;
  itemBonus?: number;
  itemBonusLabel?: string;
  rolls?: number[];
  advantageReason?: string;
  successChance?: number;
  summary: string;
  gainedItems: string[];
  lostItems: string[];
  hpChange: number;
  goldChange: number;
  xpGained?: number;
  levelBefore?: number;
  levelAfter?: number;
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
