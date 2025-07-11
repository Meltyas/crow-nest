import { MODULE_ID, SETTING_PATROLS } from "@/constants";
import type { Group, GroupMember, GroupSkill } from "@/shared/group";

export type PatrolSkill = GroupSkill;
export type PatrolMember = GroupMember;
export type Patrol = Group;

export function getPatrols(): Patrol[] {
  const stored =
    (game.settings.get(MODULE_ID, SETTING_PATROLS) as Patrol[]) ?? [];
  return stored.map((p) => ({ mods: {}, ...p }));
}

export async function savePatrols(patrols: Patrol[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_PATROLS, patrols);
}
