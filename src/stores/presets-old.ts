import type { 
  LegacyPresetCollection, 
  PresetItem, 
  PresetCollection,
  Resource,
  Reputation,
  PatrolEffect,
  Skill,
  BasePresetItem
} from "@/shared/preset";
import { SyncManager, createSyncEvent } from "@/utils/sync";
import { writable, get } from "svelte/store";

// Main store for all presets (everything is a preset, components filter by groupId)
export const presetsStore = writable<PresetCollection>({
  resources: [],
  reputation: [],
  patrolEffects: [],
  skills: [],
});

// Legacy alias for backward compatibility
export const unifiedPresetsStore = presetsStore;

// Legacy store for backward compatibility with old system
export const legacyPresetsStore = writable<LegacyPresetCollection>({
  resources: [],
  reputations: [],
  patrolEffects: [],
  situationalModifiers: [],
});

// Utility functions to get presets by scope
export function getGlobalResources(): Resource[] {
  const data = get(presetsStore);
  return data.resources.filter(r => !r.groupId); // Global presets have no groupId
}

export function getGroupResources(groupId: string): Resource[] {
  const data = get(presetsStore);
  return data.resources.filter(r => r.groupId === groupId);
}

export function getAllResources(): Resource[] {
  const data = get(presetsStore);
  return data.resources;
}

export function getGlobalReputation(): Reputation[] {
  const data = get(presetsStore);
  return data.reputation.filter(r => !r.groupId);
}

export function getGroupReputation(groupId: string): Reputation[] {
  const data = get(presetsStore);
  return data.reputation.filter(r => r.groupId === groupId);
}

export function getAllReputation(): Reputation[] {
  const data = get(presetsStore);
  return data.reputation;
}

export function getGlobalPatrolEffects(): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects.filter(p => !p.groupId);
}

export function getGroupPatrolEffects(groupId: string): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects.filter(p => p.groupId === groupId);
}

export function getAllPatrolEffects(): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects;
}

export function getGlobalSkills(): Skill[] {
  const data = get(presetsStore);
  return data.skills.filter(s => !s.groupId);
}

export function getGroupSkills(groupId: string): Skill[] {
  const data = get(presetsStore);
  return data.skills.filter(s => s.groupId === groupId);
}

export function getAllSkills(): Skill[] {
  const data = get(presetsStore);
  return data.skills;
}

// CRUD operations for unified system
export async function addResource(resource: Omit<Resource, 'id' | 'createdAt'>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const newResource: Resource = {
    ...resource,
    id: `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  
  const updated = {
    ...current,
    resources: [...current.resources, newResource]
  };
  
  await persistUnifiedPresets(updated);
}

export async function updateResource(resourceId: string, updates: Partial<Resource>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    resources: current.resources.map(r => 
      r.id === resourceId ? { ...r, ...updates, lastUsed: Date.now() } : r
    )
  };
  
  await persistUnifiedPresets(updated);
}

export async function removeResource(resourceId: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    resources: current.resources.filter(r => r.id !== resourceId)
  };
  
  await persistUnifiedPresets(updated);
}

export async function addReputation(reputation: Omit<Reputation, 'id' | 'createdAt'>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const newReputation: Reputation = {
    ...reputation,
    id: `reputation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  
  const updated = {
    ...current,
    reputation: [...current.reputation, newReputation]
  };
  
  await persistUnifiedPresets(updated);
}

export async function updateReputation(reputationId: string, updates: Partial<Reputation>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    reputation: current.reputation.map(r => 
      r.id === reputationId ? { ...r, ...updates, lastUsed: Date.now() } : r
    )
  };
  
  await persistUnifiedPresets(updated);
}

export async function removeReputation(reputationId: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    reputation: current.reputation.filter(r => r.id !== reputationId)
  };
  
  await persistUnifiedPresets(updated);
}

export async function addPatrolEffect(effect: Omit<PatrolEffect, 'id' | 'createdAt'>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const newEffect: PatrolEffect = {
    ...effect,
    id: `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  
  const updated = {
    ...current,
    patrolEffects: [...current.patrolEffects, newEffect]
  };
  
  await persistUnifiedPresets(updated);
}

export async function updatePatrolEffect(effectId: string, updates: Partial<PatrolEffect>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    patrolEffects: current.patrolEffects.map(e => 
      e.id === effectId ? { ...e, ...updates, lastUsed: Date.now() } : e
    )
  };
  
  await persistUnifiedPresets(updated);
}

export async function removePatrolEffect(effectId: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    patrolEffects: current.patrolEffects.filter(e => e.id !== effectId)
  };
  
  await persistUnifiedPresets(updated);
}

export async function addSkill(skill: Omit<Skill, 'id' | 'createdAt'>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const newSkill: Skill = {
    ...skill,
    id: `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  
  const updated = {
    ...current,
    skills: [...current.skills, newSkill]
  };
  
  await persistUnifiedPresets(updated);
}

export async function updateSkill(skillId: string, updates: Partial<Skill>): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    skills: current.skills.map(s => 
      s.id === skillId ? { ...s, ...updates, lastUsed: Date.now() } : s
    )
  };
  
  await persistUnifiedPresets(updated);
}

export async function removeSkill(skillId: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const updated = {
    ...current,
    skills: current.skills.filter(s => s.id !== skillId)
  };
  
  await persistUnifiedPresets(updated);
}

// Preset application functions
export async function applyResourcePreset(presetId: string, groupId?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const preset = current.resources.find(r => r.id === presetId && r.isPreset);
  if (!preset) return;
  
  await addResource({
    name: preset.name.replace(' (Preset)', ''),
    value: preset.value,
    max: preset.max,
    color: preset.color,
    img: preset.img,
    description: preset.description,
    isPreset: false,
    groupId,
    order: preset.order,
  });
}

export async function applyReputationPreset(presetId: string, groupId?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const preset = current.reputation.find(r => r.id === presetId && r.isPreset);
  if (!preset) return;
  
  await addReputation({
    name: preset.name.replace(' (Preset)', ''),
    value: preset.value,
    max: preset.max,
    color: preset.color,
    img: preset.img,
    description: preset.description,
    isPreset: false,
    groupId,
    order: preset.order,
  });
}

export async function applyPatrolEffectPreset(presetId: string, groupId?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const preset = current.patrolEffects.find(e => e.id === presetId && e.isPreset);
  if (!preset) return;
  
  await addPatrolEffect({
    name: preset.name.replace(' (Preset)', ''),
    type: preset.type,
    statEffects: preset.statEffects,
    active: true,
    duration: preset.duration,
    img: preset.img,
    sourceId: preset.sourceId,
    description: preset.description,
    isPreset: false,
    groupId,
    order: preset.order,
  });
}

export async function applySkillPreset(presetId: string, groupId?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const preset = current.skills.find(s => s.id === presetId && s.isPreset);
  if (!preset) return;
  
  await addSkill({
    name: preset.name.replace(' (Preset)', ''),
    value: preset.value,
    color: preset.color,
    img: preset.img,
    description: preset.description,
    isPreset: false,
    groupId,
    order: preset.order,
  });
}

// Save as preset functions
export async function saveResourceAsPreset(itemId: string, presetName?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const item = current.resources.find(r => r.id === itemId && !r.isPreset);
  if (!item) return;
  
  await addResource({
    name: presetName || `${item.name} (Preset)`,
    value: item.value,
    max: item.max,
    color: item.color,
    img: item.img,
    description: item.description,
    isPreset: true,
    groupId: undefined,
    order: item.order,
  });
}

export async function saveReputationAsPreset(itemId: string, presetName?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const item = current.reputation.find(r => r.id === itemId && !r.isPreset);
  if (!item) return;
  
  await addReputation({
    name: presetName || `${item.name} (Preset)`,
    value: item.value,
    max: item.max,
    color: item.color,
    img: item.img,
    description: item.description,
    isPreset: true,
    groupId: undefined,
    order: item.order,
  });
}

export async function savePatrolEffectAsPreset(itemId: string, presetName?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const item = current.patrolEffects.find(e => e.id === itemId && !e.isPreset);
  if (!item) return;
  
  await addPatrolEffect({
    name: presetName || `${item.name} (Preset)`,
    type: item.type,
    statEffects: item.statEffects,
    active: undefined,
    duration: item.duration,
    img: item.img,
    sourceId: item.sourceId,
    description: item.description,
    isPreset: true,
    groupId: undefined,
    order: item.order,
  });
}

export async function saveSkillAsPreset(itemId: string, presetName?: string): Promise<void> {
  const current = get(unifiedPresetsStore);
  const item = current.skills.find(s => s.id === itemId && !s.isPreset);
  if (!item) return;
  
  await addSkill({
    name: presetName || `${item.name} (Preset)`,
    value: item.value,
    color: item.color,
    img: item.img,
    description: item.description,
    isPreset: true,
    groupId: undefined,
    order: item.order,
  });
}

// Unified persistence function
export async function persistUnifiedPresets(presets: UnifiedPresetCollection) {
  try {
    const game = (globalThis as any).game;
    if (!game) return;

    await game.settings.set("crow-nest", "unifiedPresets", presets);
    unifiedPresetsStore.set(presets);

    // Broadcast changes to all players
    const syncManager = SyncManager.getInstance();
    await syncManager.broadcast(createSyncEvent("presets", "update", presets));
  } catch (error) {
    console.error("[Unified Presets] Error persisting presets:", error);
  }
}

export async function loadUnifiedPresets(): Promise<UnifiedPresetCollection> {
  try {
    const game = (globalThis as any).game;
    if (!game) {
      return {
        resources: [],
        reputation: [],
        patrolEffects: [],
        skills: [],
      };
    }

    const stored = game.settings.get("crow-nest", "unifiedPresets");
    const result = stored || {
      resources: [],
      reputation: [],
      patrolEffects: [],
      skills: [],
    };

    unifiedPresetsStore.set(result);
    return result;
  } catch (error) {
    console.error("[Unified Presets] Error loading presets:", error);
    const defaultResult = {
      resources: [],
      reputation: [],
      patrolEffects: [],
      skills: [],
    };
    unifiedPresetsStore.set(defaultResult);
    return defaultResult;
  }
}

// Legacy functions for backward compatibility
export async function persistPresets(presets: PresetCollection) {
  try {
    const game = (globalThis as any).game;
    if (!game) return;

    await game.settings.set("crow-nest", "presets", presets);
    const syncManager = SyncManager.getInstance();
    await syncManager.broadcast(createSyncEvent("presets", "update", presets));
  } catch (error) {
    console.error("[Presets] Error persisting presets:", error);
  }
}

export async function loadPresets(): Promise<PresetCollection> {
  try {
    const game = (globalThis as any).game;
    if (!game) {
      return {
        resources: [],
        reputations: [],
        patrolEffects: [],
        situationalModifiers: [],
      };
    }

    const stored = game.settings.get("crow-nest", "presets");
    const result = stored || {
      resources: [],
      reputations: [],
      patrolEffects: [],
      situationalModifiers: [],
    };

    if (!result.resources) result.resources = [];
    if (!result.reputations) result.reputations = [];
    if (!result.patrolEffects) result.patrolEffects = [];
    if (!result.situationalModifiers) result.situationalModifiers = [];
    
    presetsStore.set(result);
    return result;
  } catch (error) {
    console.error("[Presets] Error loading presets:", error);
    const defaultResult = {
      resources: [],
      reputations: [],
      patrolEffects: [],
      situationalModifiers: [],
    };
    presetsStore.set(defaultResult);
    return defaultResult;
  }
}

// Initialize presets system - Legacy compatibility function
export async function initializePresets() {
  console.log('[initializePresets] Starting presets initialization...');
  try {
    await loadPresets();
    await loadUnifiedPresets();
    console.log('[initializePresets] Presets initialization complete');
  } catch (error) {
    console.error('[initializePresets] Error during initialization:', error);
  }
}

// Add preset function for legacy compatibility
export async function addPreset(preset: PresetItem) {
  const current = get(presetsStore);
  
  switch (preset.type) {
    case "resource":
      current.resources.push(preset);
      break;
    case "reputation":
      current.reputations.push(preset);
      break;
    case "patrolEffect":
    case "situationalModifier":
      current.patrolEffects.push(preset);
      break;
    default:
      console.warn('[addPreset] Unknown preset type:', preset.type);
      return;
  }
  
  await persistPresets(current);
}

// Remove preset function for legacy compatibility
export async function removePreset(presetId: string, type: string) {
  const current = get(presetsStore);
  
  switch (type) {
    case "resource":
      current.resources = current.resources.filter(p => p.id !== presetId);
      break;
    case "reputation":
      current.reputations = current.reputations.filter(p => p.id !== presetId);
      break;
    case "patrolEffect":
    case "situationalModifier":
      current.patrolEffects = current.patrolEffects.filter(p => p.id !== presetId);
      break;
    default:
      console.warn('[removePreset] Unknown preset type:', type);
      return;
  }
  
  await persistPresets(current);
}

// Update preset usage for legacy compatibility
export async function updatePresetUsage(presetId: string, type: string) {
  const current = get(presetsStore);
  let updated = false;
  
  switch (type) {
    case "resource":
      current.resources = current.resources.map(p => {
        if (p.id === presetId) {
          updated = true;
          return { ...p, lastUsed: Date.now() };
        }
        return p;
      });
      break;
    case "reputation":
      current.reputations = current.reputations.map(p => {
        if (p.id === presetId) {
          updated = true;
          return { ...p, lastUsed: Date.now() };
        }
        return p;
      });
      break;
    case "patrolEffect":
    case "situationalModifier":
      current.patrolEffects = current.patrolEffects.map(p => {
        if (p.id === presetId) {
          updated = true;
          return { ...p, lastUsed: Date.now() };
        }
        return p;
      });
      break;
    default:
      console.warn('[updatePresetUsage] Unknown preset type:', type);
      return;
  }
  
  if (updated) {
    await persistPresets(current);
  }
}