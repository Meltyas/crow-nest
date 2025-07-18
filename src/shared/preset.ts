export interface PresetItem {
  id: string;
  name: string;
  type: "resource" | "reputation" | "patrolEffect" | "situationalModifier";
  description?: string;
  data: any; // Estructura específica según el tipo
  createdAt: number;
  lastUsed?: number;
}

export interface ResourcePreset {
  name: string;
  value: number;
  description?: string;
  img?: string;
}

export interface ReputationPreset {
  name: string;
  value: number;
  description?: string;
  img?: string;
}

export interface PatrolEffectPreset {
  name: string;
  description?: string;
  type: string;
  value: number;
  duration: string;
  statEffects: { [key: string]: number };
}

export interface SituationalModifierPreset {
  name: string;
  description?: string;
  situation: string;
  img?: string;
  statEffects: { [key: string]: number };
  sourceId?: string;
}

export interface PresetCollection {
  resources: PresetItem[];
  reputations: PresetItem[];
  patrolEffects: PresetItem[];
  situationalModifiers: PresetItem[];
}
