import {
  MODULE_ID,
  SETTING_LOG,
  SETTING_MODIFIERS,
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

export interface LogEntry {
  user: string;
  time: number;
  action: string;
  previous?: unknown;
  next?: unknown;
}

export interface GuardModifier {
  key: string;
  name: string;
  description?: string;
  img?: string;
  mods: Record<string, number>;
  state?: "positive" | "neutral" | "negative";
}

export interface GuardResource {
  key: string;
  name: string;
  value: number;
  img?: string;
}

export function getStats(): GuardStat[] {
  return (game.settings.get(MODULE_ID, SETTING_STATS) as GuardStat[]) ?? [];
}

export function getLog(): LogEntry[] {
  return (game.settings.get(MODULE_ID, SETTING_LOG) as LogEntry[]) ?? [];
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

export async function saveStats(
  stats: GuardStat[],
  log: LogEntry[]
): Promise<void> {
  if (!game.user?.isGM) {
    console.log("🚫 Stats: Only GM can save stats");
    return;
  }

  console.log(
    "💾 Stats: Saving stats as GM",
    stats.length,
    "stats,",
    log.length,
    "log entries"
  );
  await game.settings.set(MODULE_ID, SETTING_STATS, stats);
  await game.settings.set(MODULE_ID, SETTING_LOG, log);

  // Broadcast changes to all players
  const syncManager = SyncManager.getInstance();
  await syncManager.broadcast(
    createSyncEvent("stats", "update", { stats, log })
  );
}

export async function saveModifiers(modifiers: GuardModifier[]): Promise<void> {
  if (!game.user?.isGM) {
    console.log("🚫 Modifiers: Only GM can save modifiers");
    return;
  }

  console.log(
    "💾 Modifiers: Saving modifiers as GM",
    modifiers.length,
    "modifiers"
  );
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
  if (!game.user?.isGM) {
    console.log("🚫 Resources: Only GM can save resources");
    return;
  }

  console.log(
    "💾 Resources: Saving resources as GM",
    resources.length,
    "resources"
  );
  await game.settings.set(MODULE_ID, SETTING_RESOURCES, resources);

  // Broadcast changes to all players
  const syncManager = SyncManager.getInstance();
  await syncManager.broadcast(
    createSyncEvent("resources", "update", resources)
  );
}
