import type { PresetItem } from "@/shared/preset";
import PopupFocusManager from "@/utils/popup-focus";
import PresetPopup from "./presets-popup.svelte";

export class PresetManager {
  private static instance: PresetManager;
  private activePopup: any = null;
  private container: HTMLElement | null = null;

  static getInstance(): PresetManager {
    if (!PresetManager.instance) {
      PresetManager.instance = new PresetManager();
    }
    return PresetManager.instance;
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

  updatePresetFromItem(
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
    }
  }
}

export const presetManager = PresetManager.getInstance();
