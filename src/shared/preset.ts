// Simplified base interface - sourceId is required
export interface BasePresetItem {
  sourceId: string;
}

// Resource interface - keeping it simple
export interface Resource extends BasePresetItem {
  id: string;
  name: string;
  value: number;
  img?: string;
  groupId?: string; // undefined = global, string = group-specific
  description?: string; // For details in ItemCard
  active?: boolean; // Para mostrar en guard (true) o solo en presets (false)
  guardOrder?: number; // Order when displayed in guard (lower = higher priority)
  presetOrder?: number; // Order when displayed in preset manager (lower = higher priority)
}

// Reputation interface
export interface Reputation extends BasePresetItem {
  id: string;
  name: string;
  value: number;
  img?: string;
  groupId?: string; // undefined = global, string = group-specific
  description?: string; // For details in ItemCard
  active?: boolean; // Para mostrar en guard (true) o solo en presets (false)
  guardOrder?: number; // Order when displayed in guard (lower = higher priority)
  presetOrder?: number; // Order when displayed in preset manager (lower = higher priority)
}

// Patrol Effect interface
export interface PatrolEffect extends BasePresetItem {
  id: string;
  name: string;
  statEffects: { [key: string]: number };
  img?: string;
  groupId?: string; // undefined = global, string = group-specific
  description?: string; // For details in ItemCard
  active?: boolean; // Para mostrar en guard (true) o solo en presets (false)
  presetOrder?: number; // Order when displayed in preset manager (lower = higher priority)
}

// Situational Modifier interface
export interface SituationalModifier extends BasePresetItem {
  id: string;
  name: string;
  statEffects: { [key: string]: number };
  img?: string;
  groupId?: string; // undefined = global, string = group-specific
  description?: string; // For details in ItemCard
  active?: boolean; // Para mostrar en guard (true) o solo en presets (false)
  guardOrder?: number; // Order when displayed in guard (lower = higher priority)
  presetOrder?: number; // Order when displayed in preset manager (lower = higher priority)
}

// Preset collection interface (all items are presets, components filter by groupId)
export interface PresetCollection {
  resources: Resource[];
  reputations: Reputation[];
  patrolEffects: PatrolEffect[];
  situationalModifiers: SituationalModifier[];
}

// Legacy interface for backward compatibility with old unified naming
export interface UnifiedPresetCollection extends PresetCollection {}
