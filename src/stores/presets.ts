import type {
  PatrolEffect,
  PresetCollection,
  Reputation,
  Resource,
  SituationalModifier,
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
  try {
    const data = get(presetsStore);
    return data?.resources?.filter((r) => !r.groupId) || []; // Global presets have no groupId
  } catch (error) {
    console.warn("Error getting global resources:", error);
    return [];
  }
}

export function getGroupResources(groupId: string): Resource[] {
  try {
    const data = get(presetsStore);
    return data?.resources?.filter((r) => r.groupId === groupId) || [];
  } catch (error) {
    console.warn("Error getting group resources:", error);
    return [];
  }
}

export function getAllResources(): Resource[] {
  try {
    const data = get(presetsStore);
    return data?.resources || [];
  } catch (error) {
    console.warn("Error getting all resources:", error);
    return [];
  }
}

export function getGlobalReputations(): Reputation[] {
  try {
    const data = get(presetsStore);
    return data?.reputations?.filter((r) => !r.groupId) || [];
  } catch (error) {
    console.warn("Error getting global reputations:", error);
    return [];
  }
}

export function getGroupReputations(groupId: string): Reputation[] {
  try {
    const data = get(presetsStore);
    return data?.reputations?.filter((r) => r.groupId === groupId) || [];
  } catch (error) {
    console.warn("Error getting group reputations:", error);
    return [];
  }
}

export function getAllReputations(): Reputation[] {
  try {
    const data = get(presetsStore);
    return data?.reputations || [];
  } catch (error) {
    console.warn("Error getting all reputations:", error);
    return [];
  }
}

export function getGlobalPatrolEffects(): PatrolEffect[] {
  try {
    const data = get(presetsStore);
    return data?.patrolEffects?.filter((e) => !e.groupId) || [];
  } catch (error) {
    console.warn("Error getting global patrol effects:", error);
    return [];
  }
}

export function getGroupPatrolEffects(groupId: string): PatrolEffect[] {
  try {
    const data = get(presetsStore);
    return data?.patrolEffects?.filter((e) => e.groupId === groupId) || [];
  } catch (error) {
    console.warn("Error getting group patrol effects:", error);
    return [];
  }
}

export function getAllPatrolEffects(): PatrolEffect[] {
  try {
    const data = get(presetsStore);
    return data?.patrolEffects || [];
  } catch (error) {
    console.warn("Error getting all patrol effects:", error);
    return [];
  }
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
  presetsStore.set(updated); // Actualizar store inmediatamente
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
  presetsStore.set(updated); // Actualizar store inmediatamente
  await persistPresets(updated);
}

export async function togglePatrolEffectActive(
  effectId: string
): Promise<void> {
  console.log("[Presets] togglePatrolEffectActive called with effectId:", effectId);
  const current = get(presetsStore);
  
  // Find the current patrol effect to see its current state
  const currentEffect = current.patrolEffects.find(e => e.id === effectId);
  console.log("[Presets] Current patrol effect state:", currentEffect ? { id: currentEffect.id, name: currentEffect.name, active: currentEffect.active } : 'NOT FOUND');
  
  const updated = {
    ...current,
    patrolEffects: current.patrolEffects.map((e) =>
      e.id === effectId ? { ...e, active: !e.active } : e
    ),
  };
  
  // Find the updated patrol effect to confirm the change
  const updatedEffect = updated.patrolEffects.find(e => e.id === effectId);
  console.log("[Presets] Updated patrol effect state:", updatedEffect ? { id: updatedEffect.id, name: updatedEffect.name, active: updatedEffect.active } : 'NOT FOUND');
  
  presetsStore.set(updated); // Actualizar store inmediatamente
  await persistPresets(updated);
}

export async function toggleSituationalModifierActive(
  modifierId: string
): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    situationalModifiers: current.situationalModifiers.map((m) =>
      m.id === modifierId ? { ...m, active: !m.active } : m
    ),
  };
  presetsStore.set(updated); // Actualizar store inmediatamente
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

  presetsStore.set(updated); // Update store immediately for reactivity
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

  presetsStore.set(updated); // Update store immediately for reactivity
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

// SituationalModifier CRUD operations
export async function addSituationalModifier(
  modifier: Omit<SituationalModifier, "id">
): Promise<void> {
  const current = get(presetsStore);
  const newModifier: SituationalModifier = {
    ...modifier,
    id: `modifier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  const updated = {
    ...current,
    situationalModifiers: [...current.situationalModifiers, newModifier],
  };

  await persistPresets(updated);
}

export async function updateSituationalModifier(
  modifierId: string,
  updates: Partial<SituationalModifier>
): Promise<void> {
  console.log("[Presets Store] updateSituationalModifier called with:", {
    modifierId,
    updates,
  });
  const current = get(presetsStore);
  console.log(
    "[Presets Store] Current situational modifiers:",
    current.situationalModifiers.map((m) => ({ id: m.id, name: m.name }))
  );

  const updated = {
    ...current,
    situationalModifiers: current.situationalModifiers.map((m) =>
      m.id === modifierId ? { ...m, ...updates } : m
    ),
  };

  console.log(
    "[Presets Store] Updated situational modifiers:",
    updated.situationalModifiers.map((m) => ({ id: m.id, name: m.name }))
  );
  await persistPresets(updated);
}

export async function removeSituationalModifier(
  modifierId: string
): Promise<void> {
  const current = get(presetsStore);
  const updated = {
    ...current,
    situationalModifiers: current.situationalModifiers.filter(
      (m) => m.id !== modifierId
    ),
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

export async function deleteSituationalModifierPreset(
  modifierId: string
): Promise<void> {
  await removeSituationalModifier(modifierId);
}

// Persistence and synchronization functions
async function persistPresets(presets: PresetCollection): Promise<void> {
  try {
    console.log("[Presets] persistPresets called with:");
    console.log("  - Patrol Effects:", presets.patrolEffects.map((p) => ({ id: p.id, name: p.name, active: p.active })));
    console.log("  - Situational Modifiers:", presets.situationalModifiers.map((m) => ({ id: m.id, name: m.name, active: m.active })));
    console.log("  - Resources:", presets.resources.map((r) => ({ id: r.id, name: r.name, active: r.active })));
    console.log("  - Reputations:", presets.reputations.map((rep) => ({ id: rep.id, name: rep.name, active: rep.active })));
    
    const game = (globalThis as any).game;
    if (!game || !game.settings) {
      console.warn(
        "[Presets] Game settings not available yet, skipping persist"
      );
      return;
    }

    await game.settings.set("crow-nest", "unifiedPresets", presets);
    presetsStore.set(presets);
    console.log("[Presets] Store updated and settings saved");

    const syncManager = SyncManager.getInstance();
    await syncManager.broadcast(
      createSyncEvent("unifiedPresets", "update", presets)
    );
    console.log("[Presets] Sync broadcast completed");
  } catch (error) {
    console.error("[Presets] Error persisting presets:", error);
  }
}

export async function loadPresets(): Promise<void> {
  try {
    const game = (globalThis as any).game;
    if (!game || !game.settings) {
      console.warn("Game settings not available yet, skipping preset loading");
      return;
    }

    const saved = await game.settings.get("crow-nest", "unifiedPresets");
    if (saved) {
      const presets = saved as PresetCollection;

      // Ensure all preset items have active property
      const normalizedPresets: PresetCollection = {
        resources:
          presets.resources?.map((r) => ({
            ...r,
            active: r.active ?? false,
          })) || [],
        reputations:
          presets.reputations?.map((r) => ({
            ...r,
            active: r.active ?? false,
          })) || [],
        patrolEffects:
          presets.patrolEffects?.map((e) => ({
            ...e,
            active: e.active ?? false,
          })) || [],
        situationalModifiers: presets.situationalModifiers || [],
      };

      presetsStore.set(normalizedPresets);
    }
  } catch (error) {
    console.error("Error loading presets:", error);
  }
}

// DO NOT auto-initialize store here - let main.ts handle initialization
// Commented out: loadPresets();

// Initialization function for compatibility
export async function initializePresets(): Promise<void> {
  await loadPresets();
}

// Legacy alias for backwards compatibility
export const loadUnifiedPresets = loadPresets;
