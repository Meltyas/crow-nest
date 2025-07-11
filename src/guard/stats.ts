import { MODULE_ID, SETTING_STATS, SETTING_LOG } from "@/constants";

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

export function getStats(): GuardStat[] {
  return (game.settings.get(MODULE_ID, SETTING_STATS) as GuardStat[]) ?? [];
}

export function getLog(): LogEntry[] {
  return (game.settings.get(MODULE_ID, SETTING_LOG) as LogEntry[]) ?? [];
}

export async function saveStats(stats: GuardStat[], log: LogEntry[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_STATS, stats);
  await game.settings.set(MODULE_ID, SETTING_LOG, log);
}
