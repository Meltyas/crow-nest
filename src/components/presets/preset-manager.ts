import type { PresetItem } from "@/shared/preset";
import PopupFocusManager from "@/utils/popup-focus";
import PresetPopup from "./presets-popup.svelte";

export class PresetManager {
  private static instance: PresetManager;
  private activePopup: any = null;
  private container: HTMLElement | null = null;
  private isInitialized = false;

  static getInstance(): PresetManager {
    if (!PresetManager.instance) {
      PresetManager.instance = new PresetManager();
    }
    return PresetManager.instance;
  }

  constructor() {
    // Inicializar automáticamente cuando se crea la instancia
    this.initialize();
  }

  private async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Esperar a que el juego esté listo
    if (typeof game !== "undefined" && game.ready) {
      this.setupSync();
    } else {
      // Esperar hasta que el juego esté listo
      const waitForGame = () => {
        if (typeof game !== "undefined" && game.ready) {
          this.setupSync();
        } else {
          setTimeout(waitForGame, 100);
        }
      };
      waitForGame();
    }
  }

  private async setupSync() {
    // Importar y configurar la sincronización de presets
    try {
      const { presetsStore } = await import("@/stores/presets");
      // Suscribirse a los cambios en el store para mantener sincronización
      presetsStore.subscribe(() => {
        // Esta suscripción mantiene el store activo y sincronizado
      });
    } catch (error) {
      console.warn("Error setting up preset sync:", error);
    }
  }

  showPresetPopup(initialPosition?: { x: number; y: number }) {
    // Si ya está abierto, solo darle foco de manera suave
    if (this.activePopup) {
      this.focusPopup();
      return;
    }

    // Cargar la posición guardada en localStorage si no se proporciona una inicial
    let position = initialPosition;
    if (!position) {
      position = this.loadPosition();
    }

    // Crear contenedor para el popup
    this.container = document.createElement("div");
    document.body.appendChild(this.container);

    // Crear componente Svelte
    this.activePopup = new PresetPopup({
      target: this.container,
      props: {
        visible: true,
        initialPosition: position,
      },
    });

    // Dar focus al popup una vez que esté completamente cargado (solo visual)
    setTimeout(() => {
      this.focusPopup();
    }, 50);

    // Manejar eventos básicos
    this.activePopup.$on("close", () => {
      this.closePresetPopup();
    });

    this.activePopup.$on("positionChange", (event: any) => {
      this.savePosition(event.detail);
    });

    this.activePopup.$on("usePreset", (event: any) => {
      this.handleUsePreset(event.detail);
    });
  }

  focusPopup() {
    // Usar PopupFocusManager para manejar el focus visual (solo CSS)
    if (this.activePopup && this.container) {
      const popupElement = this.container.querySelector(".presets-popup");
      if (popupElement) {
        const focusManager = PopupFocusManager.getInstance();
        focusManager.setFocus(popupElement);

        // No necesitamos reinforceFocus aquí ya que no manejamos focus del teclado
      }
    }
  }

  closePresetPopup() {
    if (this.activePopup) {
      this.activePopup.$destroy();
      this.activePopup = null;
    }

    if (this.container) {
      document.body.removeChild(this.container);
      this.container = null;
    }
  }

  private savePosition(position: { x: number; y: number }) {
    try {
      localStorage.setItem(
        "crow-nest-presets-position",
        JSON.stringify(position)
      );
    } catch (error) {
      // Silent error handling
    }
  }

  private getLastPosition(): { x: number; y: number } | null {
    try {
      const stored = localStorage.getItem("crow-nest-presets-position");
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  private loadPosition(): { x: number; y: number } {
    const savedPosition = this.getLastPosition();
    return savedPosition || { x: 100, y: 100 };
  }

  private handleUsePreset(preset: PresetItem) {
    // NO cerrar el popup de presets - mantenerlo abierto para reutilización
    const event = new CustomEvent("crow-nest-use-preset", {
      detail: preset,
    });
    window.dispatchEvent(event);

    // Restaurar el focus al popup de presets después de usar un preset
    // Usar un pequeño delay para asegurar que las operaciones del preset se completen
    setTimeout(() => {
      this.focusPopup();
    }, 100);
  }

  isOpen(): boolean {
    return this.activePopup !== null;
  }

  createPresetFromExistingItem(
    item: any,
    type:
      | "resource"
      | "reputation"
      | "temporaryModifier"
      | "situationalModifier"
  ) {
    // Si el popup no está abierto, abrirlo primero
    if (!this.activePopup) {
      this.showPresetPopup();
    } else {
      // Si ya está abierto, darle focus
      this.focusPopup();
    }

    // Usar setTimeout para asegurar que el popup esté completamente cargado
    setTimeout(() => {
      if (this.activePopup) {
        this.activePopup.createPresetFromExistingItem(item, type);
      }
    }, 100);
  }

  async updatePresetFromItem(
    item: any,
    type:
      | "resource"
      | "reputation"
      | "temporaryModifier"
      | "situationalModifier"
  ) {
    // Si el popup está abierto, actualizar el preset correspondiente
    if (this.activePopup) {
      this.activePopup.updatePresetFromItem(item, type);
    } else {
      // Si no hay popup abierto, actualizar los presets directamente
      await this.updatePresetDirectly(item, type);
    }
  }

  private async updatePresetDirectly(
    item: any,
    type:
      | "resource"
      | "reputation"
      | "temporaryModifier"
      | "situationalModifier"
  ) {
    // Importar el store de presets dinámicamente
    const { presetsStore, persistPresets } = await import("@/stores/presets");

    // Obtener los presets actuales
    let currentPresets: any = null;
    const unsubscribe = presetsStore.subscribe((presets) => {
      currentPresets = presets;
    });
    unsubscribe();

    if (!currentPresets || !item.key) return;

    // Determinar el array de presets según el tipo
    const presetsArray =
      type === "resource"
        ? currentPresets.resources
        : type === "reputation"
          ? currentPresets.reputations
          : type === "temporaryModifier"
            ? currentPresets.temporaryModifiers
            : currentPresets.situationalModifiers;

    // Buscar el preset existente con el mismo sourceId
    const existingPreset = presetsArray.find(
      (p: any) => p.data.sourceId === item.key
    );

    if (existingPreset) {
      // Actualizar el preset existente
      existingPreset.data = {
        ...existingPreset.data,
        name: item.name,
        value: item.value,
        description: item.details || item.description || "",
        img: item.img || existingPreset.data.img,
      };
      existingPreset.name = item.name;
      existingPreset.description = item.details || item.description || "";

      // Actualizar el store
      presetsStore.update((presets) => ({ ...presets }));

      // IMPORTANTE: Persistir los cambios para que se sincronicen
      await persistPresets(currentPresets);

      console.log("Preset updated directly:", existingPreset);
    }
  }
}

export const presetManager = PresetManager.getInstance();
