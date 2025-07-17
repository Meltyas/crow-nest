import {
  MODULE_ID,
  SETTING_MODIFIERS,
  SETTING_REPUTATION,
  SETTING_RESOURCES,
  SETTING_STATS,
} from "@/constants";
import { SyncManager, createSyncEvent } from "@/utils/sync";

export interface GuardStat {
  key: string;
  name: string;
  value: number;
  img?: string;
}

export interface GuardModifier {
  key: string;
  name: string;
  description?: string;
  img?: string;
  mods: Record<string, number>;
  state?: "positive" | "neutral" | "negative";
  sourceId?: string; // Optional field for linking to presets
}

export interface GuardResource {
  key: string;
  name: string;
  value: number;
  img?: string;
  details?: string; // Campo para detalles/descripción del recurso
}

export interface GuardReputation {
  key: string;
  name: string;
  value: number; // 0-10
  img?: string;
  details?: string; // Campo para detalles/notas sobre la reputación
}

export function getStats(): GuardStat[] {
  return (game.settings.get(MODULE_ID, SETTING_STATS) as GuardStat[]) ?? [];
}

export function getModifiers(): GuardModifier[] {
  const modifiers =
    (game.settings.get(MODULE_ID, SETTING_MODIFIERS) as GuardModifier[]) ?? [];

  // Sort modifiers by state: positive, neutral, negative
  return modifiers.sort((a, b) => {
    const stateOrder = { positive: 0, neutral: 1, negative: 2 };
    const aState = a.state || "neutral";
    const bState = b.state || "neutral";
    return stateOrder[aState] - stateOrder[bState];
  });
}

export async function saveStats(stats: GuardStat[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_STATS, stats);

  // Broadcast changes to all players
  const syncManager = SyncManager.getInstance();
  await syncManager.broadcast(createSyncEvent("stats", "update", { stats }));
}

export async function saveModifiers(modifiers: GuardModifier[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_MODIFIERS, modifiers);

  // Broadcast changes to all players
  const syncManager = SyncManager.getInstance();
  await syncManager.broadcast(
    createSyncEvent("modifiers", "update", modifiers)
  );
}

export function getResources(): GuardResource[] {
  return (
    (game.settings.get(MODULE_ID, SETTING_RESOURCES) as GuardResource[]) ?? []
  );
}

export async function saveResources(resources: GuardResource[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_RESOURCES, resources);

  // Broadcast changes to all players
  const syncManager = SyncManager.getInstance();
  await syncManager.broadcast(
    createSyncEvent("resources", "update", resources)
  );
}

export function getReputation(): GuardReputation[] {
  return (
    (game.settings.get(MODULE_ID, SETTING_REPUTATION) as GuardReputation[]) ??
    []
  );
}

export async function saveReputation(
  reputation: GuardReputation[]
): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_REPUTATION, reputation);

  // Broadcast changes to all players
  const syncManager = SyncManager.getInstance();
  await syncManager.broadcast(
    createSyncEvent("reputation", "update", reputation)
  );
}
