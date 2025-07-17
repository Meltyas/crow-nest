import { MODULE_ID, SETTING_PATROLS } from "@/constants";
import type { Group, GroupMember, GroupSkill } from "@/shared/group";
import { SyncManager, createSyncEvent } from "@/utils/sync";

export type PatrolSkill = GroupSkill;
export type PatrolMember = GroupMember;
export type Patrol = Group;

export function getPatrols(): Patrol[] {
  const stored =
    (game.settings.get(MODULE_ID, SETTING_PATROLS) as Patrol[]) ?? [];
  const result = stored.map((p) => ({ mods: {}, ...p }));
  return result;
}

export async function savePatrols(patrols: Patrol[]): Promise<void> {
  if (!game.user?.isGM) {
    return;
  }

  await game.settings.set(MODULE_ID, SETTING_PATROLS, patrols);

  // Broadcast changes to all players
  const syncManager = SyncManager.getInstance();
  await syncManager.broadcast(createSyncEvent("patrols", "update", patrols));
}
