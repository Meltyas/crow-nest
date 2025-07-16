import type { GuardStat } from "@/guard/stats";
import { getModifiers, getStats } from "@/guard/stats";
import type { Group } from "@/shared/group";

// Foundry globals
declare const Roll: any;

export class PatrolHandlers {
  // Data references
  private stats: GuardStat[] = [];
  private modifiers: any[] = [];
  private group: Group;
  private labels: any;
  private onRollStat?: (
    stat: GuardStat,
    group: Group,
    baseValue: number,
    totalModifier: number,
    guardModifiers: any[]
  ) => void;

  constructor(
    group: Group,
    labels: any,
    private updateComponent: () => void,
    onRollStat?: (
      stat: GuardStat,
      group: Group,
      baseValue: number,
      totalModifier: number,
      guardModifiers: any[]
    ) => void
  ) {
    this.group = group;
    this.labels = labels;
    this.onRollStat = onRollStat;
    this.loadData();
  }

  // Update group reference
  updateGroup(group: Group) {
    this.group = group;
  }

  // Update labels reference
  updateLabels(labels: any) {
    this.labels = labels;
  }

  // Load stats and modifiers data
  private loadData() {
    this.stats = getStats() as GuardStat[];
    this.modifiers = getModifiers();
  }

  // Calculate guard bonus for a stat
  guardBonus = (key: string): number => {
    return this.modifiers.reduce((acc, m) => acc + (m.mods[key] || 0), 0);
  };

  // Calculate total stat value including group modifiers
  totalStat = (stat: GuardStat, group: Group): number => {
    return stat.value + this.guardBonus(stat.key) + (group.mods[stat.key] || 0);
  };

  // Handle stat roll - either trigger dialog or fallback to simple roll
  handleRollStat = (stat: GuardStat) => {
    if (this.onRollStat) {
      // Use the roll dialog if callback is provided
      const baseValue = stat.value;
      const totalModifier =
        this.guardBonus(stat.key) + (this.group.mods[stat.key] || 0);
      this.onRollStat(
        stat,
        this.group,
        baseValue,
        totalModifier,
        this.modifiers
      );
    } else {
      // Fallback to simple d20 roll
      const total = this.totalStat(stat, this.group);
      const r = new Roll(`1d20 + ${total}`);
      r.evaluate();

      const lines: string[] = [stat.name, `Guard base value ${stat.value}`];
      const guardMod = this.guardBonus(stat.key);
      if (guardMod) {
        lines.push(`Guard modifier ${guardMod > 0 ? "+" : ""}${guardMod}`);
      }
      const groupMod = this.group.mods[stat.key];
      if (groupMod) {
        lines.push(`Patrol modifier ${groupMod > 0 ? "+" : ""}${groupMod}`);
      }

      const groupName =
        this.group.name ||
        (this.group.officer
          ? `${this.labels.groupSingular} de ${this.group.officer.name}`
          : "Grupo");
      const headerImg = this.group.officer
        ? `<img src="${this.group.officer.img}" alt="${this.group.officer.name}" width="32" height="32" style="vertical-align:middle;margin-right:0.5rem;"/>`
        : "";
      const header = `<div style="display:flex;align-items:center;gap:0.5rem;">${headerImg}<strong>${groupName}</strong></div>`;

      const flavor = `${header}<br/>${lines.join("<br/>")}`;
      r.toMessage({ speaker: { alias: groupName }, flavor });
    }
  };

  // Handle deploy patrol
  handleDeployPatrol = () => {
    // This will be handled by the component's dispatch
    return this.group;
  };

  // Handle drag start for deploy
  handleDragDeploy = (event: DragEvent) => {
    const payload = {
      type: "CrowPatrol",
      patrolId: this.group.id,
    };
    event.dataTransfer?.setData("text/plain", JSON.stringify(payload));
  };

  // Get computed group name
  getGroupName = (): string => {
    return (
      this.group.name ||
      (this.group.officer
        ? `${this.labels.groupSingular} de ${this.group.officer.name}`
        : "Grupo")
    );
  };

  // Get current data
  getData() {
    return {
      stats: this.stats,
      modifiers: this.modifiers,
      groupName: this.getGroupName(),
    };
  }

  // Refresh data (useful for reactive updates)
  refreshData() {
    this.loadData();
    this.updateComponent();
  }
}
