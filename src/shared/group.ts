export interface GroupSkill {
  name: string;
  description: string;
  img: string;
}

export interface GroupExperience {
  name: string;
  value: number; // Positive or negative modifier for the roll
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
  soldiers: GroupMember[];
  mods: Record<string, number>;
  skills: GroupSkill[];
  experiences: GroupExperience[];
  maxSoldiers: number;
  hope: number; // 0-6 hope level
  maxHope: number; // 1-6 maximum hope level
}
