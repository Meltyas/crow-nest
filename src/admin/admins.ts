import { MODULE_ID, SETTING_ADMINS } from "@/constants";

export interface AdminSkill {
  name: string;
  description: string;
  img: string;
}

export interface AdminMember {
  id: string;
  name: string;
  img: string;
}

export interface Admin {
  id: string;
  name: string;
  officer: AdminMember | null;
  soldiers: AdminMember[];
  mods: Record<string, number>;
  skills: AdminSkill[];
}

export function getAdmins(): Admin[] {
  const stored =
    (game.settings.get(MODULE_ID, SETTING_ADMINS) as Admin[]) ?? [];
  return stored.map((p) => ({ mods: {}, ...p }));
}

export async function saveAdmins(admins: Admin[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_ADMINS, admins);
}
