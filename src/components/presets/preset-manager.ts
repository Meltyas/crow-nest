import PresetPopup from './presets-popup.svelte';
import type { PresetItem } from '@/shared/preset';

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
    // Si ya está abierto, no hacer nada
    if (this.activePopup) {
      return;
    }

    // Crear contenedor para el popup
    this.container = document.createElement('div');
    document.body.appendChild(this.container);

    // Crear componente Svelte
    this.activePopup = new PresetPopup({
      target: this.container,
      props: {
        visible: true,
        initialPosition: initialPosition || { x: 100, y: 100 }
      }
    });

    // Manejar eventos
    this.activePopup.$on('close', () => {
      this.closePresetPopup();
    });

    this.activePopup.$on('positionChange', (event: any) => {
      // Opcionalmente guardar posición
      this.savePosition(event.detail);
    });

    this.activePopup.$on('usePreset', (event: any) => {
      this.handleUsePreset(event.detail);
    });
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
      localStorage.setItem('crow-nest-presets-position', JSON.stringify(position));
    } catch (error) {
      // Silent error handling
    }
  }

  private getLastPosition(): { x: number; y: number } | null {
    try {
      const stored = localStorage.getItem('crow-nest-presets-position');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  private handleUsePreset(preset: PresetItem) {
    // Cerrar el popup de presets
    this.closePresetPopup();

    // Disparar evento personalizado para que lo escuche el guard popup
    const event = new CustomEvent('crow-nest-use-preset', {
      detail: preset
    });
    window.dispatchEvent(event);
  }

  isOpen(): boolean {
    return this.activePopup !== null;
  }
}

export const presetManager = PresetManager.getInstance();
