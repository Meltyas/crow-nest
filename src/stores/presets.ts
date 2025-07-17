import type { PresetCollection, PresetItem } from "@/shared/preset";
import { SyncManager, createSyncEvent } from "@/utils/sync";
import { writable } from "svelte/store";

// Store para los presets
export const presetsStore = writable<PresetCollection>({
  resources: [],
  reputations: [],
  temporaryModifiers: [],
  situationalModifiers: [],
});

// Funciones para persistir presets
export async function persistPresets(presets: PresetCollection) {
  try {
    const game = (globalThis as any).game;
    if (!game) return;

    await game.settings.set("crow-nest", "presets", presets);

    // Broadcast changes to all players
    const syncManager = SyncManager.getInstance();
    await syncManager.broadcast(createSyncEvent("presets", "update", presets));
  } catch (error) {
    console.error("[Presets] Error persisting presets:", error);
  }
}

export async function loadPresets(): Promise<PresetCollection> {
  try {
    const game = (globalThis as any).game;
    if (!game) {
      return {
        resources: [],
        reputations: [],
        temporaryModifiers: [],
        situationalModifiers: [],
      };
    }

    const stored = game.settings.get("crow-nest", "presets");
    return (
      stored || {
        resources: [],
        reputations: [],
        temporaryModifiers: [],
        situationalModifiers: [],
      }
    );
  } catch (error) {
    console.error("[Presets] Error loading presets:", error);
    return {
      resources: [],
      reputations: [],
      temporaryModifiers: [],
      situationalModifiers: [],
    };
  }
}

// Funciones de utilidad para manejar presets
export function addPreset(preset: PresetItem) {
  presetsStore.update((presets) => {
    const category =
      preset.type === "resource"
        ? "resources"
        : preset.type === "reputation"
          ? "reputations"
          : preset.type === "temporaryModifier"
            ? "temporaryModifiers"
            : "situationalModifiers";

    presets[category].push(preset);
    persistPresets(presets);
    return presets;
  });
}

export function removePreset(id: string, type: PresetItem["type"]) {
  presetsStore.update((presets) => {
    const category =
      type === "resource"
        ? "resources"
        : type === "reputation"
          ? "reputations"
          : type === "temporaryModifier"
            ? "temporaryModifiers"
            : "situationalModifiers";

    presets[category] = presets[category].filter((p) => p.id !== id);
    persistPresets(presets);
    return presets;
  });
}

export function updatePresetUsage(id: string, type: PresetItem["type"]) {
  presetsStore.update((presets) => {
    const category =
      type === "resource"
        ? "resources"
        : type === "reputation"
          ? "reputations"
          : type === "temporaryModifier"
            ? "temporaryModifiers"
            : "situationalModifiers";

    const preset = presets[category].find((p) => p.id === id);
    if (preset) {
      preset.lastUsed = Date.now();
      persistPresets(presets);
    }
    return presets;
  });
}

// Inicializar presets
export async function initializePresets() {
  const loadedPresets = await loadPresets();
  presetsStore.set(loadedPresets);

  // Set up sync handler for presets
  const syncManager = SyncManager.getInstance();
  syncManager.subscribe("presets", (event) => {
    if (event.action === "update") {
      presetsStore.set(event.data);
    }
  });
}
