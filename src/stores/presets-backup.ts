import type {
  PatrolEffect,
  PresetCollection,
  Reputation,
  Resource,
} from "@/shared/preset";
import { SyncManager, createSyncEvent } from "@/utils/sync";
import { get, writable } from "svelte/store";

// Main store for all presets (everything is a preset, components filter by groupId)
export const presetsStore = writable<PresetCollection>({
  resources: [],
  reputations: [],
  patrolEffects: [],
  situationalModifiers: [],
});

// Legacy alias for backward compatibility
export const unifiedPresetsStore = presetsStore;

// Utility functions to get presets by scope
export function getGlobalResources(): Resource[] {
  const data = get(presetsStore);
  return data.resources.filter((r) => !r.groupId); // Global presets have no groupId
}

export function getGroupResources(groupId: string): Resource[] {
  const data = get(presetsStore);
  return data.resources.filter((r) => r.groupId === groupId);
}

export function getAllResources(): Resource[] {
  const data = get(presetsStore);
  return data.resources;
}

export function getGlobalReputations(): Reputation[] {
  const data = get(presetsStore);
  return data.reputations.filter((r) => !r.groupId);
}

export function getGroupReputations(groupId: string): Reputation[] {
  const data = get(presetsStore);
  return data.reputations.filter((r) => r.groupId === groupId);
}

export function getAllReputations(): Reputation[] {
  const data = get(presetsStore);
  return data.reputations;
}

// Funciones para obtener solo elementos activos (para mostrar en Guard)
export function getActiveGlobalResources(): Resource[] {
  const data = get(presetsStore);
  return data.resources.filter((r) => !r.groupId && r.active === true);
}

export function getActiveGroupResources(groupId: string): Resource[] {
  const data = get(presetsStore);
  return data.resources.filter((r) => r.groupId === groupId && r.active === true);
}

export function getActiveGlobalReputations(): Reputation[] {
  const data = get(presetsStore);
  return data.reputations.filter((r) => !r.groupId && r.active === true);
}

export function getActiveGroupReputations(groupId: string): Reputation[] {
  const data = get(presetsStore);
  return data.reputations.filter((r) => r.groupId === groupId && r.active === true);
}

// Funciones para activar/desactivar elementos
export async function toggleResourceActive(resourceId: string): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    resources: current.resources.map((r) =>
      r.id === resourceId ? { ...r, active: !r.active } : r
    ),
  };
  await persistPresets(updated);
}

export async function toggleReputationActive(reputationId: string): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    reputations: current.reputations.map((r) =>
      r.id === reputationId ? { ...r, active: !r.active } : r
    ),
  };
  await persistPresets(updated);
}

export function getGlobalPatrolEffects(): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects.filter((p) => !p.groupId);
}

export function getGroupPatrolEffects(groupId: string): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects.filter((p) => p.groupId === groupId);
}

export function getAllPatrolEffects(): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects;
}

// CRUD operations for unified system
export async function addResource(
  resource: Omit<Resource, "id">
): Promise<void> {
  const current = get(presetsStore);
  const newResource: Resource = {
    ...resource,
    id: `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  const updated = {
    ...current,
    resources: [...current.resources, newResource],
  };

  await persistPresets(updated);
}

export async function updateResource(
  resourceId: string,
  updates: Partial<Resource>
): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    resources: current.resources.map((r) =>
      r.id === resourceId ? { ...r, ...updates, lastUsed: Date.now() } : r
    ),
  };

  await persistPresets(updated);
}

export async function removeResource(resourceId: string): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    resources: current.resources.filter((r) => r.id !== resourceId),
  };

  await persistPresets(updated);
}

export async function addReputation(
  reputation: Omit<Reputation, "id">
): Promise<void> {
  const current = get(presetsStore);
  const newReputation: Reputation = {
    ...reputation,
    id: `reputation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  const updated = {
    ...current,
    reputations: [...current.reputations, newReputation],
  };

  await persistPresets(updated);
}

export async function updateReputation(
  reputationId: string,
  updates: Partial<Reputation>
): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    reputations: current.reputations.map((r) =>
      r.id === reputationId ? { ...r, ...updates, lastUsed: Date.now() } : r
    ),
  };

  await persistPresets(updated);
}

export async function removeReputation(reputationId: string): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    reputations: current.reputations.filter((r) => r.id !== reputationId),
  };

  await persistPresets(updated);
}

export async function addPatrolEffect(
  effect: Omit<PatrolEffect, "id">
): Promise<void> {
  const current = get(presetsStore);
  const newEffect: PatrolEffect = {
    ...effect,
    id: `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  const updated = {
    ...current,
    patrolEffects: [...current.patrolEffects, newEffect],
  };

  await persistPresets(updated);
}

export async function updatePatrolEffect(
  effectId: string,
  updates: Partial<PatrolEffect>
): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    patrolEffects: current.patrolEffects.map((e) =>
      e.id === effectId ? { ...e, ...updates, lastUsed: Date.now() } : e
    ),
  };

  await persistPresets(updated);
}

export async function removePatrolEffect(effectId: string): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    patrolEffects: current.patrolEffects.filter((e) => e.id !== effectId),
  };

  await persistPresets(updated);
}

// Apply preset to group functions
export async function applyResourceToGroup(
  resourceId: string,
  groupId: string
): Promise<void> {
  const current = get(presetsStore);
  const resource = current.resources.find((r) => r.id === resourceId);
  if (!resource) return;

  await addResource({
    name: resource.name,
    value: resource.value,
    max: resource.max,
    color: resource.color,
    img: resource.img,
    description: resource.description,
    groupId,
    order: resource.order,
  });
}

export async function applyReputationToGroup(
  reputationId: string,
  groupId: string
): Promise<void> {
  const current = get(presetsStore);
  const reputation = current.reputations.find((r) => r.id === reputationId);
  if (!reputation) return;

  await addReputation({
    name: reputation.name,
    value: reputation.value,
    img: reputation.img,
    sourceId: reputation.sourceId,
    groupId,
  });
}

export async function applyPatrolEffectToGroup(
  effectId: string,
  groupId: string
): Promise<void> {
  const current = get(presetsStore);
  const effect = current.patrolEffects.find((e) => e.id === effectId);
  if (!effect) return;

  await addPatrolEffect({
    name: effect.name,
    type: effect.type,
    statEffects: effect.statEffects,
    active: true,
    duration: effect.duration,
    img: effect.img,
    sourceId: effect.sourceId,
    description: effect.description,
    groupId,
    order: effect.order,
  });
}

export async function applySkillToGroup(
  skillId: string,
  groupId: string
): Promise<void> {
  const current = get(presetsStore);
  const skill = current.skills.find((s) => s.id === skillId);
  if (!skill) return;

  await addSkill({
    name: skill.name,
    value: skill.value,
    color: skill.color,
    img: skill.img,
    description: skill.description,
    groupId,
    order: skill.order,
  });
}

// Unified persistence function
export async function persistPresets(presets: PresetCollection) {
  try {
    const game = (globalThis as any).game;
    if (!game) return;

    await game.settings.set("crow-nest", "unifiedPresets", presets);
    presetsStore.set(presets);

    const syncManager = SyncManager.getInstance();
    await syncManager.broadcast(
      createSyncEvent("unifiedPresets", "update", presets)
    );
  } catch (error) {
    console.error("[Presets] Error persisting presets:", error);
  }
}

export async function loadPresets(): Promise<PresetCollection> {
  try {
    const game = (globalThis as any).game;
    if (!game) {
      const defaultResult: PresetCollection = {
        resources: [],
        reputations: [],
        patrolEffects: [],
        situationalModifiers: [],
      };
      return defaultResult;
    }

    const savedData = await game.settings.get("crow-nest", "unifiedPresets");

    if (!savedData) {
      const defaultResult: PresetCollection = {
        resources: [],
        reputations: [],
        patrolEffects: [],
        situationalModifiers: [],
      };

      presetsStore.set(defaultResult);
      return defaultResult;
    }

    // Ensure all required arrays exist
    const result: PresetCollection = {
      resources: savedData.resources || [],
      reputations: savedData.reputations || savedData.reputation || [],
      patrolEffects: savedData.patrolEffects || [],
      situationalModifiers:
        savedData.situationalModifiers || savedData.skills || [],
    };

    presetsStore.set(result);
    return result;
  } catch (error) {
    console.error("[Presets] Error loading presets:", error);
    const defaultResult: PresetCollection = {
      resources: [],
      reputations: [],
      patrolEffects: [],
      situationalModifiers: [],
    };

    presetsStore.set(defaultResult);
    return defaultResult;
  }
}

// Legacy compatibility functions
export async function persistUnifiedPresets(presets: PresetCollection) {
  return persistPresets(presets);
}

export async function loadUnifiedPresets(): Promise<PresetCollection> {
  return loadPresets();
}

// Legacy compatibility for old function names
export function getResourcePresets(): Resource[] {
  return getGlobalResources();
}

export function getActiveResources(): Resource[] {
  return getAllResources();
}

export function getReputationPresets(): Reputation[] {
  return getGlobalReputations();
}

export function getActiveReputation(): Reputation[] {
  return getAllReputations();
}

export function getPatrolEffectPresets(): PatrolEffect[] {
  return getGlobalPatrolEffects();
}

export function getActivePatrolEffects(groupId?: string): PatrolEffect[] {
  return groupId ? getGroupPatrolEffects(groupId) : getAllPatrolEffects();
}

export function getSkillPresets(): Skill[] {
  return getGlobalSkills();
}

export function getActiveSkills(groupId?: string): Skill[] {
  return groupId ? getGroupSkills(groupId) : getAllSkills();
}

export async function applyResourcePreset(
  presetId: string,
  groupId?: string
): Promise<void> {
  if (groupId) {
    return applyResourceToGroup(presetId, groupId);
  }
  // Si no hay groupId, es aplicar un preset global, que ya existe
}

export async function applyReputationPreset(
  presetId: string,
  groupId?: string
): Promise<void> {
  if (groupId) {
    return applyReputationToGroup(presetId, groupId);
  }
}

export async function applyPatrolEffectPreset(
  presetId: string,
  groupId?: string
): Promise<void> {
  if (groupId) {
    return applyPatrolEffectToGroup(presetId, groupId);
  }
}

export async function applySkillPreset(
  presetId: string,
  groupId?: string
): Promise<void> {
  if (groupId) {
    return applySkillToGroup(presetId, groupId);
  }
}

export async function saveResourceAsPreset(
  itemId: string,
  presetName?: string
): Promise<void> {
  const current = get(presetsStore);
  const item = current.resources.find((r) => r.id === itemId);
  if (!item || !item.groupId) return; // Solo convertir items de grupo a globales

  await addResource({
    name: presetName || item.name,
    value: item.value,
    max: item.max,
    color: item.color,
    img: item.img,
    description: item.description,
    groupId: undefined, // Hacerlo global
    order: item.order,
  });
}

export async function saveReputationAsPreset(
  itemId: string,
  presetName?: string
): Promise<void> {
  const current = get(presetsStore);
  const item = current.reputations.find((r) => r.id === itemId);
  if (!item || !item.groupId) return;

  await addReputation({
    name: presetName || item.name,
    value: item.value,
    img: item.img,
    sourceId: item.sourceId,
    groupId: undefined,
  });
}

export async function savePatrolEffectAsPreset(
  itemId: string,
  presetName?: string
): Promise<void> {
  const current = get(presetsStore);
  const item = current.patrolEffects.find((e) => e.id === itemId);
  if (!item || !item.groupId) return;

  await addPatrolEffect({
    name: presetName || item.name,
    type: item.type,
    statEffects: item.statEffects,
    active: undefined,
    duration: item.duration,
    img: item.img,
    sourceId: item.sourceId,
    description: item.description,
    groupId: undefined,
    order: item.order,
  });
}

export async function saveSkillAsPreset(
  itemId: string,
  presetName?: string
): Promise<void> {
  const current = get(presetsStore);
  const item = current.skills.find((s) => s.id === itemId);
  if (!item || !item.groupId) return;

  await addSkill({
    name: presetName || item.name,
    value: item.value,
    color: item.color,
    img: item.img,
    description: item.description,
    groupId: undefined,
    order: item.order,
  });
}

// Legacy functions for backward compatibility
export async function initializePresets(): Promise<void> {
  await loadPresets();
}

export async function removePreset(presetId: string): Promise<void> {
  const current = get(presetsStore);

  // Find and remove from any array
  const foundInResources = current.resources.find((r) => r.id === presetId);
  if (foundInResources) {
    await removeResource(presetId);
    return;
  }

  const foundInReputation = current.reputations.find((r) => r.id === presetId);
  if (foundInReputation) {
    await removeReputation(presetId);
    return;
  }

  const foundInPatrolEffects = current.patrolEffects.find(
    (e) => e.id === presetId
  );
  if (foundInPatrolEffects) {
    await removePatrolEffect(presetId);
    return;
  }

  const foundInSituationalModifiers = current.situationalModifiers.find(
    (s) => s.id === presetId
  );
  if (foundInSituationalModifiers) {
    await removeSituationalModifier(presetId);
    return;
  }
}

export async function updatePresetUsage(presetId: string): Promise<void> {
  const current = get(presetsStore);

  // Find and update lastUsed in any array
  const foundInResources = current.resources.find((r) => r.id === presetId);
  if (foundInResources) {
    await updateResource(presetId, { lastUsed: Date.now() });
    return;
  }

  const foundInReputation = current.reputations.find((r) => r.id === presetId);
  if (foundInReputation) {
    await updateReputation(presetId, {});
    return;
  }

  const foundInPatrolEffects = current.patrolEffects.find(
    (e) => e.id === presetId
  );
  if (foundInPatrolEffects) {
    await updatePatrolEffect(presetId, {});
    return;
  }

  const foundInSituationalModifiers = current.situationalModifiers.find(
    (s) => s.id === presetId
  );
  if (foundInSituationalModifiers) {
    await updateSituationalModifier(presetId, {});
    return;
  }
}

// Alias functions for backward compatibility (SituationalModifier -> Skill)
export const getGlobalSituationalModifiers = getGlobalSkills;
export const getGroupSituationalModifiers = getGroupSkills;
export const getAllSituationalModifiers = getAllSkills;
export const addSituationalModifier = addSkill;
export const updateSituationalModifier = updateSkill;
export const removeSituationalModifier = removeSkill;
