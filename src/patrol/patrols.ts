import { MODULE_ID, SETTING_PATROLS } from "@/constants";

export interface PatrolSkill {
  name: string;
  description: string;
  img: string;
}

export interface PatrolMember {
  id: string;
  name: string;
  img: string;
}

export interface Patrol {
  id: string;
  name: string;
  officer: PatrolMember | null;
  soldiers: PatrolMember[];
  mods: Record<string, number>;
  skills: PatrolSkill[];
}

export function getPatrols(): Patrol[] {
  const stored =
    (game.settings.get(MODULE_ID, SETTING_PATROLS) as Patrol[]) ?? [];
  return stored.map((p) => ({ mods: {}, ...p }));
}

export async function savePatrols(patrols: Patrol[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_PATROLS, patrols);
}
