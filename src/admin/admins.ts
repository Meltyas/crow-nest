import { MODULE_ID, SETTING_ADMINS } from "@/constants";
import type { Group, GroupMember, GroupSkill } from "@/shared/group";

export type AdminSkill = GroupSkill;
export type AdminMember = GroupMember;
export type Admin = Group;

export function getAdmins(): Admin[] {
  const stored =
    (game.settings.get(MODULE_ID, SETTING_ADMINS) as Admin[]) ?? [];
  return stored.map((p) => ({ mods: {}, ...p }));
}

export async function saveAdmins(admins: Admin[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_ADMINS, admins);
}
