export interface GroupSkill {
  name: string;
  description: string;
  img: string;
}

export interface GroupExperience {
  name: string;
  value: number; // Positive or negative modifier for the roll
}

export interface GroupTemporaryModifier {
  name: string;
  description: string;
  statEffects: Record<string, number>; // Multiple stat keys with their respective values
}

export interface GroupTemporaryModifiers {
  [modifierId: string]: GroupTemporaryModifier; // Temporary modifiers indexed by unique ID
}

export interface GroupMember {
  id: string;
  name: string;
  img: string;
}

export interface Group {
  id: string;
  name: string;
  officer: GroupMember | null;
  units: GroupMember[];
  mods: Record<string, number>;
  skills: GroupSkill[];
  experiences: GroupExperience[];
  temporaryModifiers: GroupTemporaryModifiers;
  maxUnits: number;
  hope: number; // 0-6 hope level
  maxHope: number; // 1-6 maximum hope level
}
