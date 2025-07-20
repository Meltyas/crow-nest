export interface GroupSkill {
  name: string;
  description: string;
  img: string;
}

export interface GroupExperience {
  name: string;
  value: number; // Positive or negative modifier for the roll
}

export interface GroupPatrolEffect {
  name: string;
  description: string;
  statEffects: Record<string, number>; // Multiple stat keys with their respective values
  sourceId?: string; // For sync compatibility
  key?: string; // For sync compatibility
}

export interface GroupPatrolEffects {
  [modifierId: string]: GroupPatrolEffect; // Patrol effects indexed by unique ID
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
  soldiers: GroupMember[]; // Array for formation layout positions
  mods: Record<string, number>;
  skills: GroupSkill[];
  experiences: GroupExperience[];
  patrolEffects: GroupPatrolEffects;
  patrolOrder: { [effectId: string]: number }; // Order for patrol effects within this group
  maxUnits: number;
  maxSoldiers: number; // Maximum number of soldiers for formation layout
  hope: number; // 0-6 hope level
  maxHope: number; // 1-6 maximum hope level
}
