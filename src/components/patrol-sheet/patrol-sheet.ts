import { MODULE_ID } from "@/constants";
import type { Group } from "@/shared/group";
import PatrolSheetPopup from "./patrol-sheet-popup.svelte";

export class PatrolSheetManager {
  private static instance: PatrolSheetManager;
  public activeSheets: Map<string, any> = new Map(); // Made public for main.ts access
  private storageKey = "crow-nest-open-patrol-sheets";
  private positionsKey = "crow-nest-patrol-positions"; // Nueva clave para posiciones históricas

  static getInstance(): PatrolSheetManager {
    if (!PatrolSheetManager.instance) {
      PatrolSheetManager.instance = new PatrolSheetManager();
    }
    return PatrolSheetManager.instance;
  }

  constructor() {
    this.restoreOpenSheets();
  }

  // Función para que el GM fuerce la ficha a todos (UPDATED: now uses settings!)
  async forceShowPatrolSheetToAll(group: Group, labels: any) {
    return this.forceShowPatrolSheetToAllViaSettings(group, labels, {
      showToGM: true,
    });
  }

  // Función para abrir ficha individual (GM o jugador)
  showPatrolSheet(
    group: Group,
    labels: any,
    savedPosition?: { x: number; y: number } | null
  ) {
    // Si ya está abierta, no hacer nada
    if (this.activeSheets.has(group.id)) {
      return;
    }

    // Si no se proporciona una posición guardada, buscar en localStorage
    if (!savedPosition) {
      savedPosition = this.getLastKnownPosition(group.id);
    }

    // Crear contenedor para el popup
    const container = document.createElement("div");
    document.body.appendChild(container);

    // Crear componente Svelte
    const component = new PatrolSheetPopup({
      target: container,
      props: {
        group: group,
        labels: labels,
        visible: true,
        initialPosition: savedPosition || undefined,
      },
    });

    // Manejar el evento de cierre
    component.$on("close", () => {
      this.closePatrolSheet(group.id);
    });

    // Manejar cambios de posición
    component.$on("positionChange", (event) => {
      this.updateSheetPosition(group.id, event.detail);
    });

    // Manejar deploy desde la ficha
    component.$on("deploy", (event) => {
      this.deployPatrolFromSheet(event.detail);
    });

    // Manejar actualizaciones del grupo (como cambios de Hope)
    component.$on("updateGroup", (event) => {
      this.updateGroup(event.detail);
    });

    // Guardar referencia
    this.activeSheets.set(group.id, {
      component: component,
      container: container,
      position: savedPosition || null,
    });

    // Guardar en localStorage
    this.saveOpenSheetsToStorage();
  }

  updateSheetPosition(groupId: string, position: { x: number; y: number }) {
    const sheet = this.activeSheets.get(groupId);
    if (sheet) {
      sheet.position = position;
      this.saveOpenSheetsToStorage();
      // También guardar posición histórica
      this.savePositionToHistory(groupId, position);
    }
  }

  // Update group data and persist changes
  async updateGroup(updatedGroup: Group) {
    try {
      // Import the required functions
      const { groupsStore, persistGroups } = await import("@/stores/groups");

      // Update the store
      groupsStore.update((groups) => {
        const groupIndex = groups.findIndex((g) => g.id === updatedGroup.id);
        if (groupIndex !== -1) {
          groups[groupIndex] = { ...groups[groupIndex], ...updatedGroup };
        }
        return groups;
      });

      // Persist the changes
      let currentGroups: Group[] = [];
      const unsubscribe = groupsStore.subscribe((groups) => {
        currentGroups = groups;
      });
      unsubscribe(); // Immediately unsubscribe after getting the current value

      await persistGroups(currentGroups);

      // Auto-sync with presets when group is updated
      try {
        const { PresetManager } = await import(
          "@/components/presets/preset-manager"
        );
        const presetManager = PresetManager.getInstance();
        await presetManager.updatePresetDirectly(updatedGroup.id, updatedGroup);
      } catch (presetError) {
        console.warn(
          "[PatrolSheetManager] Could not sync with presets:",
          presetError
        );
      }
    } catch (error) {
      console.error("[PatrolSheetManager] Error updating group:", error);
    }
  }

  // Función para obtener la última posición conocida de un grupo
  getLastKnownPosition(groupId: string): { x: number; y: number } | null {
    try {
      const stored = localStorage.getItem(this.positionsKey);
      const positions = stored ? JSON.parse(stored) : {};
      return positions[groupId] || null;
    } catch (error) {
      return null;
    }
  }

  // Función para guardar posición en historial
  private savePositionToHistory(
    groupId: string,
    position: { x: number; y: number }
  ) {
    try {
      const stored = localStorage.getItem(this.positionsKey);
      const positions = stored ? JSON.parse(stored) : {};
      positions[groupId] = position;
      localStorage.setItem(this.positionsKey, JSON.stringify(positions));
    } catch (error) {
      // Silent error handling
    }
  }

  closePatrolSheet(groupId: string) {
    const sheet = this.activeSheets.get(groupId);
    if (sheet) {
      // IMPORTANTE: Guardar posición en historial ANTES de cerrar la ficha
      if (sheet.position) {
        this.savePositionToHistory(groupId, sheet.position);
      }

      // Destruir componente Svelte
      sheet.component.$destroy();
      // Remover contenedor del DOM
      document.body.removeChild(sheet.container);
      // Remover de la lista activa
      this.activeSheets.delete(groupId);
      // Actualizar localStorage (solo fichas activas)
      this.saveOpenSheetsToStorage();
    }
  }

  closeAllPatrolSheets() {
    this.activeSheets.forEach((sheet, groupId) => {
      this.closePatrolSheet(groupId);
    });
  }

  // Función común para deploy de patrullas (reutilizable)
  async deployPatrolFromSheet(group: Group) {
    if (!group.officer && (!group.units || group.units.length === 0)) {
      (ui as any).notifications?.warn("No members in the group to deploy");
      return;
    }

    const members = [] as any[];
    if (group.officer) members.push(group.officer);
    members.push(...group.units);

    // Get canvas position (center of canvas view)
    const canvas = (game as any).canvas;
    if (!canvas) {
      (ui as any).notifications?.error("Cannot access canvas");
      return;
    }

    const viewPosition = canvas.stage.pivot;
    const grid = canvas.grid.size;
    let offsetX = 0;
    let offsetY = 0;
    const tokensToCreate = [] as any[];
    const tokensToMove = [] as any[];
    const movedTokenIds = new Set<string>();

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const actor = (game as any).actors?.get(member.id);
      if (!actor) continue;

      // Find ALL tokens of this actor on canvas that we haven't moved yet
      const existingTokens = canvas.tokens.placeables.filter(
        (token: any) =>
          token.document.actorId === actor.id &&
          !movedTokenIds.has(token.document.id)
      );

      const newX = viewPosition.x + offsetX;
      const newY = viewPosition.y + offsetY;

      if (existingTokens.length > 0) {
        // Move only the first token we haven't moved yet
        const token = existingTokens[0];
        movedTokenIds.add(token.document.id);

        tokensToMove.push({
          _id: token.document.id,
          x: newX,
          y: newY,
        });
      } else {
        // No unmoved tokens found, create new token
        const doc = await actor.getTokenDocument({
          x: newX,
          y: newY,
        });
        tokensToCreate.push(doc.toObject());
      }

      offsetX += grid;
      if ((i + 1) % 5 === 0) {
        offsetX = 0;
        offsetY += grid;
      }
    }

    // Execute operations
    if (tokensToMove.length) {
      for (const tokenUpdate of tokensToMove) {
        const token = canvas.tokens.get(tokenUpdate._id);
        if (token) {
          await token.document.update({ x: tokenUpdate.x, y: tokenUpdate.y });
        }
      }
    }

    if (tokensToCreate.length) {
      await canvas.scene?.createEmbeddedDocuments("Token", tokensToCreate);
    }

    const groupName =
      group.name ||
      (group.officer ? `Patrulla de ${group.officer.name}` : "Grupo");
    (ui as any).notifications?.info(
      `${groupName} deployed on the map (${members.length} members, ${tokensToMove.length} moved, ${tokensToCreate.length} created)`
    );
  }

  // Funciones de localStorage
  private saveOpenSheetsToStorage() {
    const openSheets = Array.from(this.activeSheets.entries()).map(
      ([groupId, sheet]) => ({
        groupId: groupId,
        position: sheet.position,
      })
    );
    localStorage.setItem(this.storageKey, JSON.stringify(openSheets));
  }

  private getOpenSheetsFromStorage(): Array<{
    groupId: string;
    position: { x: number; y: number } | null;
  }> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  private restoreOpenSheets() {
    // Función para intentar restaurar
    const attemptRestore = (attempt = 1, maxAttempts = 10) => {
      const openSheets = this.getOpenSheetsFromStorage();

      if (openSheets.length === 0) {
        return;
      }

      // Verificar que el juego esté listo
      if (!game || !game.ready) {
        if (attempt < maxAttempts) {
          setTimeout(() => attemptRestore(attempt + 1, maxAttempts), 500);
        }
        return;
      }

      // Obtener grupos disponibles
      const crowNestModule = game.modules?.get("crow-nest") as any;

      if (crowNestModule?.api?.getGroups) {
        const groups = crowNestModule.api.getGroups();

        if (groups && groups.length > 0) {
          let restored = 0;
          openSheets.forEach((sheetData) => {
            const group = groups.find((g: Group) => g.id === sheetData.groupId);
            if (group) {
              // Restaurar ficha con labels por defecto y posición guardada
              const defaultLabels = {
                groupSingular: "Patrol",
              };
              this.showPatrolSheet(group, defaultLabels, sheetData.position);
              restored++;
            }
          });

          if (restored > 0) {
            return;
          }
        }
      }

      // Si llegamos aquí, algo falló. Intentar de nuevo si no hemos alcanzado el máximo
      if (attempt < maxAttempts) {
        const delay = Math.min(attempt * 500, 2000); // Máximo 2 segundos de delay
        setTimeout(() => attemptRestore(attempt + 1, maxAttempts), delay);
      }
    };

    // Esperar un poco para que el juego esté completamente cargado
    setTimeout(() => attemptRestore(), 100);
  }

  // Función para obtener todo el historial de posiciones
  private getPositionHistory() {
    try {
      const stored = localStorage.getItem(this.positionsKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  // ==============================================
  // NEW: Settings-based patrol sheet sync (much simpler than sockets!)
  // ==============================================

  // Method to handle active patrol sheets updates from settings
  handleActivePatrolSheetsUpdate(activeSheets: any, updatedByUserId: string) {
    // Ensure activeSheets is an array
    let sheetsArray: any[] = [];
    if (Array.isArray(activeSheets)) {
      sheetsArray = activeSheets;
    } else if (
      activeSheets &&
      typeof activeSheets === "object" &&
      activeSheets.value
    ) {
      // Sometimes Foundry passes {value: [...]} structure
      sheetsArray = Array.isArray(activeSheets.value) ? activeSheets.value : [];
    } else {
      return;
    }

    // Don't process updates from our own user (to avoid loops)
    if (updatedByUserId === (game as any).user?.id) {
      return;
    }

    // Process each active sheet
    sheetsArray.forEach((sheetData: any) => {
      // Check if we should show this sheet
      if (this.shouldShowPatrolSheet(sheetData)) {
        this.showPatrolSheetFromSetting(sheetData);
      }
    });

    // Note: We don't automatically close sheets when they're removed from the list
    // This allows for better UX - sheets stay open until manually closed
  }

  // Check if current user should show this patrol sheet
  private shouldShowPatrolSheet(sheetData: any): boolean {
    // Don't show if already open
    if (this.activeSheets.has(sheetData.groupId)) {
      return false;
    }

    // Check if sheet is meant for current user (optional targeting)
    if (
      sheetData.targetUsers &&
      !sheetData.targetUsers.includes((game as any).user?.id)
    ) {
      return false;
    }

    return true;
  }

  // Show patrol sheet from setting data
  private showPatrolSheetFromSetting(sheetData: any) {
    // Get the group data
    const groups = (game.modules?.get("crow-nest") as any)?.api?.getGroups?.();

    if (!groups) {
      return;
    }

    const group = groups.find((g: any) => g.id === sheetData.groupId);

    if (!group) {
      return;
    }

    // Use default labels or provided ones
    const labels = sheetData.labels || { groupSingular: "Patrol" };

    this.showPatrolSheet(group, labels);
  }

  // NEW: Settings-based method to show patrol sheet to all users
  async forceShowPatrolSheetToAllViaSettings(
    group: Group,
    labels: any,
    options: any = {}
  ) {
    // Show to current user first if requested
    if (options.showToGM !== false) {
      this.showPatrolSheet(group, labels);
    }

    // STEP 1: Clear the list first (so all players register it's empty)
    await (game as any).settings.set(MODULE_ID, "activePatrolSheets", []);

    // STEP 2: Wait a bit for all clients to process the empty list
    await new Promise((resolve) => setTimeout(resolve, 300)); // 300ms delay

    // STEP 3: Add the new patrol sheet entry
    const newSheetEntry = {
      groupId: group.id,
      groupName: group.name,
      labels: labels,
      timestamp: Date.now(),
      initiatedBy: (game as any).user?.id || "unknown",
      showToGM: options.showToGM || false,
      targetUsers: options.targetUsers || null, // null means all users
    };

    // Set the list with just this new entry
    const updatedSheets = [newSheetEntry];

    // Update the setting - this will automatically sync to all users!
    await (game as any).settings.set(
      MODULE_ID,
      "activePatrolSheets",
      updatedSheets
    );
  }

  // Method to remove a patrol sheet from active list (when closed)
  async removePatrolSheetFromActive(groupId: string) {
    const currentSheets = (game as any).settings.get(
      MODULE_ID,
      "activePatrolSheets"
    ) as any[];
    const updatedSheets = currentSheets.filter(
      (sheet) => sheet.groupId !== groupId
    );

    if (updatedSheets.length !== currentSheets.length) {
      await (game as any).settings.set(
        MODULE_ID,
        "activePatrolSheets",
        updatedSheets
      );
    }
  }

  // Method to clear all active patrol sheets (any user can do this)
  async clearAllActivePatrolSheets() {
    await (game as any).settings.set(MODULE_ID, "activePatrolSheets", []);
  }

  // Debug method to check current active sheets setting
  debugActiveSheetsSetting() {
    const activeSheets = (game as any).settings.get(
      MODULE_ID,
      "activePatrolSheets"
    );

    return {
      settingValue: activeSheets,
      currentUser: {
        name: game.user?.name,
        id: game.user?.id,
        isGM: game.user?.isGM,
      },
      localActiveSheets: Array.from(this.activeSheets.keys()),
    };
  }
}

// Exportar instancia global
export const patrolSheetManager = PatrolSheetManager.getInstance();
