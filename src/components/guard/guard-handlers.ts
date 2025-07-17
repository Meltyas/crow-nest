import type {
  GuardModifier,
  GuardReputation,
  GuardResource,
  GuardStat,
} from "@/guard/stats";
import {
  saveModifiers,
  saveReputation,
  saveResources,
  saveStats,
} from "@/guard/stats";
import type { SyncEvent } from "@/utils/sync";
import { generateUUID } from "@/utils/log";

// FilePicker is provided by Foundry at runtime
declare const FilePicker: any;
declare const game: any;
declare const Roll: any;
declare const ChatMessage: any;
declare const Hooks: any;

export class GuardHandlers {
  // Data references (passed from component)
  private stats: GuardStat[] = [];
  private modifiers: GuardModifier[] = [];
  private resources: GuardResource[] = [];
  private reputation: GuardReputation[] = [];
  private patrols: any[] = [];
  private admins: any[] = [];

  // State references (passed from component)
  private editing = false;
  private editingMods = false;
  private editingResources = false;
  private editingReputation = false;
  private expandedReputationDetails: Record<string, boolean> = {};
  public expandedResourceDetails: Record<string, boolean> = {};

  constructor(private updateComponent: () => void) {}

  // Update data references from component
  updateData(data: {
    stats: GuardStat[];
    modifiers: GuardModifier[];
    resources: GuardResource[];
    reputation: GuardReputation[];
    patrols: any[];
    admins: any[];
    editing: boolean;
    editingMods: boolean;
    editingResources: boolean;
    editingReputation: boolean;
    expandedReputationDetails: Record<string, boolean>;
    expandedResourceDetails: Record<string, boolean>;
  }) {
    this.stats = data.stats;
    this.modifiers = data.modifiers;
    this.resources = data.resources;
    this.reputation = data.reputation;
    this.patrols = data.patrols;
    this.admins = data.admins;
    this.editing = data.editing;
    this.editingMods = data.editingMods;
    this.editingResources = data.editingResources;
    this.editingReputation = data.editingReputation;
    this.expandedReputationDetails = data.expandedReputationDetails;
    this.expandedResourceDetails = data.expandedResourceDetails;
  }

  // Sync handlers
  handleStatsSync = (event: SyncEvent) => {
    if (event.type === "stats" && event.data) {
      this.stats = event.data.stats || [];
      this.updateComponent();
    }
  };

  handleModifiersSync = (event: SyncEvent) => {
    if (event.type === "modifiers") {
      this.modifiers = event.data || [];
      this.sortModifiersByState();
      this.updateComponent();
    }
  };

  handleResourcesSync = (event: SyncEvent) => {
    if (event.type === "resources") {
      this.resources = event.data || [];
      this.updateComponent();
    }
  };

  handleReputationSync = (event: SyncEvent) => {
    if (event.type === "reputation") {
      this.reputation = event.data || [];
      this.updateComponent();
    }
  };

  handlePatrolsSync = (event: SyncEvent) => {
    if (event.type === "patrols") {
      this.patrols = event.data || [];
      this.updateComponent();
    }
  };

  handleAdminsSync = (event: SyncEvent) => {
    if (event.type === "admins") {
      this.admins = event.data || [];
      this.updateComponent();
    }
  };

  // Stats handlers
  handleAddStat = (event: CustomEvent) => {
    const newStat = event.detail;
    this.stats = [...this.stats, { ...newStat }];
    this.persistStats();
    this.updateComponent();
  };

  handleRemoveStat = (event: CustomEvent) => {
    const index = event.detail;
    const [removed] = this.stats.splice(index, 1);
    this.stats = [...this.stats];
    this.persistStats();
    this.updateComponent();
  };

  handleUpdateStat = () => {
    this.stats = [...this.stats];
    this.persistStats();
    this.updateComponent();
  };

  handleImageClick = (event: CustomEvent) => {
    const stat = event.detail;
    if (this.editing) {
      if (typeof FilePicker !== "undefined") {
        new FilePicker({
          type: "image",
          current: stat.img,
          callback: (path: string) => {
            stat.img = path;
            this.handleUpdateStat();
          },
        }).render(true);
      }
    } else {
      const bonus = this.modifiers.reduce(
        (acc, m) => acc + (m.mods[stat.key] || 0),
        0
      );
      const r = new Roll(`1d20 + ${stat.value + bonus}`);
      r.evaluate();

      const lines: string[] = [];
      for (const m of this.modifiers) {
        const v = m.mods[stat.key];
        if (v) lines.push(`${m.name} ${v > 0 ? "+" : ""}${v}`);
      }

      const flavor = [stat.name, ...lines].join("<br/>");
      r.toMessage({ speaker: { alias: "La Guardia" }, flavor });
    }
  };

  handleFileChange = (event: CustomEvent) => {
    const { stat, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      stat.img = String(reader.result);
      this.handleUpdateStat();
    };
    reader.readAsDataURL(input.files[0]);
  };

  // Modifier handlers
  handleAddModifier = (event: CustomEvent) => {
    const newModifier = event.detail;
    
    // Asegurar que el modificador tenga un key único si no lo tiene
    if (!newModifier.key) {
      newModifier.key = generateUUID();
    }
    
    // Asegurar que el modificador tenga un sourceId si no lo tiene
    if (!newModifier.sourceId) {
      newModifier.sourceId = newModifier.key;
    }
    
    newModifier.mods = Object.fromEntries(
      Object.entries(newModifier.mods).filter(([, v]) => Number(v) !== 0)
    );
    
    this.modifiers = [...this.modifiers, { ...newModifier }];
    this.sortModifiersByState();
    this.persistModifiers();
    this.updateComponent();
  };

  handleRemoveModifier = (event: CustomEvent) => {
    const index = event.detail;
    this.modifiers.splice(index, 1);
    this.modifiers = [...this.modifiers];
    this.persistModifiers();
    this.updateComponent();
  };

  handleUpdateModifier = () => {
    this.modifiers = this.modifiers.map((m) => ({
      ...m,
      state: m.state || "neutral",
      mods: Object.fromEntries(
        Object.entries(m.mods).filter(([, v]) => Number(v) !== 0)
      ),
    }));
    this.sortModifiersByState();
    this.persistModifiers();
    this.updateComponent();
  };

  handleModImageClick = (event: CustomEvent) => {
    const mod = event.detail;
    if (this.editingMods) {
      if (typeof FilePicker !== "undefined") {
        new FilePicker({
          type: "image",
          current: mod.img,
          callback: (path: string) => {
            mod.img = path;
            this.handleUpdateModifier();
          },
        }).render(true);
      }
    }
  };

  handleNewModImageClick = (event: CustomEvent) => {
    const newModifier = event.detail;
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: newModifier.img,
        callback: (path: string) => {
          newModifier.img = path;
        },
      }).render(true);
    }
  };

  handleModFileChange = (event: CustomEvent) => {
    const { mod, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      mod.img = String(reader.result);
      this.handleUpdateModifier();
    };
    reader.readAsDataURL(input.files[0]);
  };

  // Reputation handlers
  handleAddReputation = (event: CustomEvent) => {
    const newReputation = event.detail;
    this.reputation = [...this.reputation, { ...newReputation }];
    this.persistReputation();
    this.updateComponent();
  };

  handleRemoveReputation = (event: CustomEvent) => {
    const index = event.detail;
    this.reputation.splice(index, 1);
    this.reputation = [...this.reputation];
    this.persistReputation();
    this.updateComponent();
  };

  handleUpdateReputation = () => {
    this.reputation = [...this.reputation];
    this.persistReputation();
    this.updateComponent();
  };

  handleRepImageClick = (event: CustomEvent) => {
    const rep = event.detail;
    if (this.editingReputation) {
      if (typeof FilePicker !== "undefined") {
        new FilePicker({
          type: "image",
          current: rep.img,
          callback: (path: string) => {
            rep.img = path;
            this.handleUpdateReputation();
          },
        }).render(true);
      }
    } else {
      this.showReputationInChat(rep);
    }
  };

  handleNewRepImageClick = (event: CustomEvent) => {
    const newReputation = event.detail;
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: newReputation.img,
        callback: (path: string) => {
          newReputation.img = path;
        },
      }).render(true);
    }
  };

  handleRepFileChange = (event: CustomEvent) => {
    const { rep, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      rep.img = String(reader.result);
      this.handleUpdateReputation();
    };
    reader.readAsDataURL(input.files[0]);
  };

  handleShowReputationInChat = (event: CustomEvent) => {
    this.showReputationInChat(event.detail);
  };

  handleToggleReputationDetails = (event: CustomEvent) => {
    const repKey = event.detail;
    this.expandedReputationDetails[repKey] =
      !this.expandedReputationDetails[repKey];
    this.expandedReputationDetails = { ...this.expandedReputationDetails };
    this.updateComponent();
  };

  // Resource handlers
  handleAddResource = (event: CustomEvent) => {
    const newResource = event.detail;
    this.resources = [...this.resources, { ...newResource }];
    this.persistResources();
    this.updateComponent();
  };

  handleRemoveResource = (event: CustomEvent) => {
    const index = event.detail;
    this.resources.splice(index, 1);
    this.resources = [...this.resources];
    this.persistResources();
    this.updateComponent();
  };

  handleUpdateResource = async () => {
    this.resources = [...this.resources];
    await this.persistResources();
    this.updateComponent();

    // Importar dinámicamente y actualizar presets para todos los recursos
    try {
      const { presetManager } = await import(
        "@/components/presets/preset-manager"
      );
      this.resources.forEach((resource) => {
        presetManager.updatePresetFromItem(resource, "resource");
      });
    } catch (error) {
      console.warn("Error updating presets:", error);
    }
  };

  handleResImageClick = (event: CustomEvent) => {
    const res = event.detail;
    const input = document.getElementById(
      `res-file-${res.key}`
    ) as HTMLInputElement | null;
    input?.click();
  };

  handleNewResImageClick = (event: CustomEvent) => {
    const newResource = event.detail;
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: newResource.img,
        callback: (path: string) => {
          newResource.img = path;
        },
      }).render(true);
    }
  };

  handleResFileChange = (event: CustomEvent) => {
    const { res, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      res.img = String(reader.result);
      this.handleUpdateResource();
    };
    reader.readAsDataURL(input.files[0]);
  };

  showResourceInChat = (res: any) => {
    const chatData = {
      content: `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #444; border-radius: 4px; background: #2a2a2a;">
          <img src="${res.img}" alt="${res.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />
          <div>
            <h4 style="margin: 0; color: #fff; font-size: 14px;">${res.name}</h4>
            <p style="margin: 0; color: #ccc; font-size: 12px;">${res.details || res.description || "Sin descripción"}</p>
          </div>
        </div>
      `,
      speaker: { alias: "Recursos del Guardia" },
    };

    ChatMessage.create(chatData);
  };

  reorderResources = (event: CustomEvent) => {
    const { dragIndex, dropIndex } = event.detail;
    if (dragIndex === dropIndex) return;

    const newResources = [...this.resources];
    const draggedResource = newResources[dragIndex];

    // Remove the dragged item
    newResources.splice(dragIndex, 1);

    // Insert it at the new position
    newResources.splice(dropIndex, 0, draggedResource);

    this.resources = newResources;
    this.handleUpdateResource();
  };

  reorderReputation = (event: CustomEvent) => {
    const { dragIndex, dropIndex } = event.detail;
    if (dragIndex === dropIndex) return;

    const newReputation = [...this.reputation];
    const draggedReputation = newReputation[dragIndex];

    // Remove the dragged item
    newReputation.splice(dragIndex, 1);

    // Insert it at the new position
    newReputation.splice(dropIndex, 0, draggedReputation);

    this.reputation = newReputation;
    this.handleUpdateReputation();
  };

  // Utility methods
  private sortModifiersByState() {
    const stateOrder = { positive: 0, neutral: 1, negative: 2 };
    this.modifiers.sort((a, b) => {
      const stateA = stateOrder[a.state || "neutral"] ?? 1;
      const stateB = stateOrder[b.state || "neutral"] ?? 1;
      return stateA - stateB;
    });
  }

  private showReputationInChat(rep: GuardReputation) {
    if (this.editingReputation) return;

    const hue = (rep.value / 10) * 120;
    const reputationColor = `hsl(${hue}, 70%, 50%)`;

    const totalBars = 10;
    const filledBars = Math.floor(rep.value);
    const progressBars = Array(totalBars)
      .fill(0)
      .map((_, i) => {
        if (i < filledBars) {
          return `<span style="color: ${reputationColor};">█</span>`;
        } else {
          return `<span style="color: #444;">█</span>`;
        }
      })
      .join("");

    const detailsSection =
      rep.details && rep.details.trim()
        ? `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid ${reputationColor}; font-style: italic; color: #000;">${rep.details}</div>`
        : "";

    const content = `
      <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border: 2px solid ${reputationColor}; border-radius: 8px; background: rgba(0,0,0,0.1);">
        <img src="${rep.img || "icons/svg/aura.svg"}" alt="${rep.name}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 2px solid ${reputationColor};" />
        <div style="flex: 1;">
          <h3 style="margin: 0 0 0.5rem 0; color: ${reputationColor}; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${rep.name}</h3>
          <div style="font-family: monospace; font-size: 1.2em; letter-spacing: 1px; color: #000;">${progressBars}</div>
          ${detailsSection}
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: { alias: "Los Cuervos - Reputación" },
      content: content,
      whisper: null,
    });
  }

  // Persistence methods
  private async persistStats() {
    await saveStats(this.stats);
  }

  private async persistModifiers() {
    await saveModifiers(this.modifiers);
  }

  private async persistResources() {
    await saveResources(this.resources);
  }

  private async persistReputation() {
    await saveReputation(this.reputation);
  }

  // Getters to return updated data to component
  getData() {
    return {
      stats: this.stats,
      modifiers: this.modifiers,
      resources: this.resources,
      reputation: this.reputation,
      patrols: this.patrols,
      admins: this.admins,
      expandedReputationDetails: this.expandedReputationDetails,
      expandedResourceDetails: this.expandedResourceDetails,
    };
  }
}
