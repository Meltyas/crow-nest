import {
  MODULE_ID,
  SETTING_STATS,
  SETTING_LOG,
  SETTING_MODIFIERS,
  SETTING_RESOURCES,
} from "@/constants";

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
  img?: string;
  mods: Record<string, number>;
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
  return (
    game.settings.get(MODULE_ID, SETTING_MODIFIERS) as GuardModifier[]
  ) ?? [];
}

export async function saveStats(stats: GuardStat[], log: LogEntry[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_STATS, stats);
  await game.settings.set(MODULE_ID, SETTING_LOG, log);
}

export async function saveModifiers(
  modifiers: GuardModifier[]
): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_MODIFIERS, modifiers);
}

export function getResources(): GuardResource[] {
  return (
    game.settings.get(MODULE_ID, SETTING_RESOURCES) as GuardResource[]
  ) ?? [];
}

export async function saveResources(resources: GuardResource[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_RESOURCES, resources);
}
