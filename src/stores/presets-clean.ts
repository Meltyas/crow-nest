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

export function getGlobalPatrolEffects(): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects.filter((e) => !e.groupId);
}

export function getGroupPatrolEffects(groupId: string): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects.filter((e) => e.groupId === groupId);
}

export function getAllPatrolEffects(): PatrolEffect[] {
  const data = get(presetsStore);
  return data.patrolEffects;
}

// Active filtering functions for guard
export function getActiveGlobalResources(): Resource[] {
  return getGlobalResources().filter((r) => r.active);
}

export function getActiveGroupResources(groupId: string): Resource[] {
  return getGroupResources(groupId).filter((r) => r.active);
}

export function getActiveGlobalReputations(): Reputation[] {
  return getGlobalReputations().filter((r) => r.active);
}

export function getActiveGroupReputations(groupId: string): Reputation[] {
  return getGroupReputations(groupId).filter((r) => r.active);
}

export function getActiveGlobalPatrolEffects(): PatrolEffect[] {
  return getGlobalPatrolEffects().filter((e) => e.active);
}

export function getActiveGroupPatrolEffects(groupId: string): PatrolEffect[] {
  return getGroupPatrolEffects(groupId).filter((e) => e.active);
}

// Toggle active state functions
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

export async function toggleReputationActive(
  reputationId: string
): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    reputations: current.reputations.map((r) =>
      r.id === reputationId ? { ...r, active: !r.active } : r
    ),
  };
  await persistPresets(updated);
}

export async function togglePatrolEffectActive(
  effectId: string
): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    patrolEffects: current.patrolEffects.map((e) =>
      e.id === effectId ? { ...e, active: !e.active } : e
    ),
  };
  await persistPresets(updated);
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
      r.id === resourceId ? { ...r, ...updates } : r
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
      r.id === reputationId ? { ...r, ...updates } : r
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
      e.id === effectId ? { ...e, ...updates } : e
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

// Delete preset functions
export async function deleteResourcePreset(resourceId: string): Promise<void> {
  await removeResource(resourceId);
}

export async function deleteReputationPreset(
  reputationId: string
): Promise<void> {
  await removeReputation(reputationId);
}

export async function deletePatrolEffectPreset(
  effectId: string
): Promise<void> {
  await removePatrolEffect(effectId);
}

// Persistence and synchronization functions
async function persistPresets(presets: PresetCollection): Promise<void> {
  presetsStore.set(presets);

  // Create sync event
  const syncEvent = createSyncEvent("presets", "update", {
    resources: presets.resources,
    reputations: presets.reputations,
    patrolEffects: presets.patrolEffects,
    situationalModifiers: presets.situationalModifiers,
  });

  // Persist to Foundry user data
  await SyncManager.saveUserData("crow-nest.presets", presets);

  // Broadcast the sync event
  SyncManager.sendSyncEvent(syncEvent);
}

export async function loadPresets(): Promise<void> {
  try {
    const saved = await SyncManager.loadUserData("crow-nest.presets");
    if (saved) {
      const presets = saved as PresetCollection;

      // Ensure all preset items have active property
      const normalizedPresets: PresetCollection = {
        resources: presets.resources.map((r) => ({
          ...r,
          active: r.active ?? true,
        })),
        reputations: presets.reputations.map((r) => ({
          ...r,
          active: r.active ?? true,
        })),
        patrolEffects: presets.patrolEffects.map((e) => ({
          ...e,
          active: e.active ?? true,
        })),
        situationalModifiers: presets.situationalModifiers || [],
      };

      presetsStore.set(normalizedPresets);
    }
  } catch (error) {
    console.error("Error loading presets:", error);
  }
}

// Initialize store
loadPresets();
