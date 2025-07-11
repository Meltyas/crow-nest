import { MODULE_ID, SETTING_PATROLS } from "@/constants";

export interface PatrolSkill {
  img: string;
  description: string;
}

export interface Patrol {
  id: string;
  officer: string;
  soldiers: string[];
  modifier: number;
  skills: PatrolSkill[];
}

export function getPatrols(): Patrol[] {
  return (game.settings.get(MODULE_ID, SETTING_PATROLS) as Patrol[]) ?? [];
}

export async function savePatrols(patrols: Patrol[]): Promise<void> {
  await game.settings.set(MODULE_ID, SETTING_PATROLS, patrols);
}
