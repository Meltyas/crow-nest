import type { PresetCollection, PresetItem } from "@/shared/preset";
import { SyncManager, createSyncEvent } from "@/utils/sync";
import { writable } from "svelte/store";

// Store para los presets
export const presetsStore = writable<PresetCollection>({
  resources: [],
  reputations: [],
  patrolEffects: [],
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
      console.log('[loadPresets] Game not available, returning default structure');
      return {
        resources: [],
        reputations: [],
        patrolEffects: [],
        situationalModifiers: [],
      };
    }

    const stored = game.settings.get("crow-nest", "presets");
    console.log('[loadPresets] Loaded from settings:', stored);
    
    const result = stored || {
      resources: [],
      reputations: [],
      patrolEffects: [],
      situationalModifiers: [],
    };
    
    // Ensure all required arrays exist
    if (!result.resources) result.resources = [];
    if (!result.reputations) result.reputations = [];
    if (!result.patrolEffects) result.patrolEffects = [];
    if (!result.situationalModifiers) result.situationalModifiers = [];
    
    console.log('[loadPresets] Final result structure:', result);
    return result;
  } catch (error) {
    console.error("[Presets] Error loading presets:", error);
    return {
      resources: [],
      reputations: [],
      patrolEffects: [],
      situationalModifiers: [],
    };
  }
}

// Funciones de utilidad para manejar presets
export function addPreset(preset: PresetItem) {
  presetsStore.update((presets) => {
    console.log('[addPreset] Current presets structure:', presets);
    console.log('[addPreset] Adding preset of type:', preset.type);
    
    const category =
      preset.type === "resource"
        ? "resources"
        : preset.type === "reputation"
          ? "reputations"
          : preset.type === "patrolEffect"
            ? "patrolEffects"
            : "situationalModifiers";

    console.log('[addPreset] Target category:', category);
    console.log('[addPreset] Category array before push:', presets[category]);
    
    // Ensure the category array exists
    if (!presets[category]) {
      console.warn(`[addPreset] Category ${category} was undefined, initializing as empty array`);
      presets[category] = [];
    }
    
    presets[category].push(preset);
    console.log('[addPreset] Category array after push:', presets[category]);
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
          : type === "patrolEffect"
            ? "patrolEffects"
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
          : type === "patrolEffect"
            ? "patrolEffects"
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
  console.log('[initializePresets] Starting initialization');
  const loadedPresets = await loadPresets();
  console.log('[initializePresets] Loaded presets:', loadedPresets);
  presetsStore.set(loadedPresets);
  console.log('[initializePresets] Store updated');

  // Set up sync handler for presets
  const syncManager = SyncManager.getInstance();
  syncManager.subscribe("presets", (event) => {
    if (event.action === "update") {
      presetsStore.set(event.data);
    }
  });
}
