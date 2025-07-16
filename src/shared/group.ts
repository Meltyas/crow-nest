export interface GroupSkill {
  name: string;
  description: string;
  img: string;
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
  maxSoldiers: number;
}
