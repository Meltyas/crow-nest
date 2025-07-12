import { MODULE_ID } from "@/constants";
import type { Group } from "@/shared/group";
import PatrolSheetPopup from "./patrol-sheet-popup.svelte";

export class PatrolSheetManager {
  private static instance: PatrolSheetManager;
  private activeSheets: Map<string, any> = new Map();
  private storageKey = "crow-nest-open-patrol-sheets";
  private positionsKey = "crow-nest-patrol-positions"; // Nueva clave para posiciones históricas

  static getInstance(): PatrolSheetManager {
    if (!PatrolSheetManager.instance) {
      PatrolSheetManager.instance = new PatrolSheetManager();
    }
    return PatrolSheetManager.instance;
  }

  constructor() {
    console.log(
      `🚀 PatrolSheetManager: Inicializando gestor de fichas de patrulla`
    );
    this.restoreOpenSheets();
  }

  // Función para que el GM fuerce la ficha a todos (UPDATED: now uses settings!)
  async forceShowPatrolSheetToAll(group: Group, labels: any) {
    console.log("📤 forceShowPatrolSheetToAll: Using settings-based method");
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
      if (savedPosition) {
        console.log(
          `🎯 PatrolSheetManager: Usando posición guardada para ${group.name || group.id}:`,
          savedPosition
        );
      }
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

  // Función para obtener la última posición conocida de un grupo
  getLastKnownPosition(groupId: string): { x: number; y: number } | null {
    try {
      const stored = localStorage.getItem(this.positionsKey);
      const positions = stored ? JSON.parse(stored) : {};
      return positions[groupId] || null;
    } catch (error) {
      console.error("Error loading position history:", error);
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
      console.log(
        `💾 PatrolSheetManager: Posición guardada para ${groupId}:`,
        position
      );
    } catch (error) {
      console.error("Error saving position history:", error);
    }
  }

  closePatrolSheet(groupId: string) {
    const sheet = this.activeSheets.get(groupId);
    if (sheet) {
      // IMPORTANTE: Guardar posición en historial ANTES de cerrar la ficha
      if (sheet.position) {
        console.log(
          `💾 PatrolSheetManager: Guardando posición final antes de cerrar ficha ${groupId}:`,
          sheet.position
        );
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

      console.log(
        `✅ PatrolSheetManager: Ficha ${groupId} cerrada, posición guardada en historial`
      );
    }
  }

  closeAllPatrolSheets() {
    this.activeSheets.forEach((sheet, groupId) => {
      this.closePatrolSheet(groupId);
    });
  }

  // Función común para deploy de patrullas (reutilizable)
  async deployPatrolFromSheet(group: Group) {
    console.log(
      `🚀 PatrolSheetManager: Desplegando patrulla ${group.name || group.id}`
    );

    if (!group.officer && (!group.soldiers || group.soldiers.length === 0)) {
      (ui as any).notifications?.warn("No members in the group to deploy");
      return;
    }

    const members = [] as any[];
    if (group.officer) members.push(group.officer);
    members.push(...group.soldiers);

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
    console.log(
      `💾 PatrolSheetManager: Guardando fichas en localStorage:`,
      openSheets
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
      console.error(
        "Error loading open patrol sheets from localStorage:",
        error
      );
      return [];
    }
  }

  private restoreOpenSheets() {
    // Función para intentar restaurar
    const attemptRestore = (attempt = 1, maxAttempts = 10) => {
      console.log(
        `🔄 PatrolSheetManager: Intento ${attempt} de restauración de fichas`
      );

      const openSheets = this.getOpenSheetsFromStorage();
      console.log(
        `📋 PatrolSheetManager: Fichas guardadas en localStorage:`,
        openSheets
      );

      if (openSheets.length === 0) {
        console.log(
          `ℹ️ PatrolSheetManager: No hay fichas guardadas para restaurar`
        );
        return;
      }

      // Verificar que el juego esté listo
      if (!game || !game.ready) {
        console.log(
          `⏳ PatrolSheetManager: El juego no está listo aún, esperando...`
        );
        if (attempt < maxAttempts) {
          setTimeout(() => attemptRestore(attempt + 1, maxAttempts), 500);
        }
        return;
      }

      // Obtener grupos disponibles
      const crowNestModule = game.modules?.get("crow-nest") as any;
      console.log(
        `🎮 PatrolSheetManager: Módulo crow-nest encontrado:`,
        !!crowNestModule
      );
      console.log(
        `🔗 PatrolSheetManager: API disponible:`,
        !!crowNestModule?.api?.getGroups
      );

      if (crowNestModule?.api?.getGroups) {
        const groups = crowNestModule.api.getGroups();
        console.log(
          `👥 PatrolSheetManager: Grupos disponibles:`,
          groups?.length || 0,
          groups
        );

        if (groups && groups.length > 0) {
          let restored = 0;
          openSheets.forEach((sheetData) => {
            const group = groups.find((g: Group) => g.id === sheetData.groupId);
            if (group) {
              console.log(
                `✅ PatrolSheetManager: Restaurando ficha para grupo ${group.name || group.id}`,
                sheetData.position
              );
              // Restaurar ficha con labels por defecto y posición guardada
              const defaultLabels = {
                groupSingular: "Patrol",
              };
              this.showPatrolSheet(group, defaultLabels, sheetData.position);
              restored++;
            } else {
              console.log(
                `❌ PatrolSheetManager: Grupo ${sheetData.groupId} no encontrado en grupos disponibles`
              );
            }
          });

          if (restored > 0) {
            console.log(
              `🎉 PatrolSheetManager: ${restored} fichas restauradas exitosamente`
            );
            return;
          }
        } else {
          console.log(
            `🔍 PatrolSheetManager: No hay grupos disponibles o lista vacía`
          );
        }
      } else {
        console.log(`❌ PatrolSheetManager: API del módulo no disponible`);
      }

      // Si llegamos aquí, algo falló. Intentar de nuevo si no hemos alcanzado el máximo
      if (attempt < maxAttempts) {
        const delay = Math.min(attempt * 500, 2000); // Máximo 2 segundos de delay
        console.log(
          `⏳ PatrolSheetManager: Reintentando en ${delay}ms... (intento ${attempt + 1}/${maxAttempts})`
        );
        setTimeout(() => attemptRestore(attempt + 1, maxAttempts), delay);
      } else {
        console.error(
          `❌ PatrolSheetManager: No se pudieron restaurar las fichas después de ${maxAttempts} intentos`
        );
      }
    };

    // Esperar un poco para que el juego esté completamente cargado
    setTimeout(() => attemptRestore(), 100);
  }

  // Función para limpiar localStorage (útil para debugging)
  clearStoredSheets() {
    localStorage.removeItem(this.storageKey);
  }

  // Función para limpiar posiciones históricas
  clearStoredPositions() {
    localStorage.removeItem(this.positionsKey);
  }

  // Función para debugging - mostrar estado actual
  debugState() {
    console.log("🔍 PatrolSheetManager Debug:");
    console.log("Active sheets:", this.activeSheets);
    console.log("LocalStorage data:", this.getOpenSheetsFromStorage());
    console.log("Position history:", this.getPositionHistory());
    console.log(
      "Available groups:",
      (game.modules?.get("crow-nest") as any)?.api?.getGroups?.()
    );
  }

  // Función para obtener todo el historial de posiciones
  private getPositionHistory() {
    try {
      const stored = localStorage.getItem(this.positionsKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading position history:", error);
      return {};
    }
  }

  // ==============================================
  // NEW: Settings-based patrol sheet sync (much simpler than sockets!)
  // ==============================================

  // Method to handle active patrol sheets updates from settings
  handleActivePatrolSheetsUpdate(activeSheets: any, updatedByUserId: string) {
    console.log(
      "📋 PatrolSheetManager: Active sheets updated by user:",
      updatedByUserId
    );
    console.log(
      "📋 Raw activeSheets data:",
      activeSheets,
      "type:",
      typeof activeSheets
    );

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
      console.log("🚫 activeSheets is not an array, skipping processing");
      return;
    }

    console.log("📋 Processed sheets array:", sheetsArray);

    // Don't process updates from our own user (to avoid loops)
    if (updatedByUserId === game.user?.id) {
      console.log("🚫 Ignoring update from self to avoid loops");
      return;
    }

    // Process each active sheet
    sheetsArray.forEach((sheetData: any) => {
      console.log("📋 Processing sheet data:", sheetData);

      // Check if we should show this sheet
      if (this.shouldShowPatrolSheet(sheetData)) {
        console.log("✅ Showing patrol sheet:", sheetData.groupId);
        this.showPatrolSheetFromSetting(sheetData);
      }
    });
  }

  // Check if current user should show this patrol sheet
  private shouldShowPatrolSheet(sheetData: any): boolean {
    // Don't show to GM if they initiated it (unless specifically requested)
    if (
      game.user?.isGM &&
      sheetData.initiatedBy === game.user.id &&
      !sheetData.showToGM
    ) {
      console.log("🚫 Skipping show for GM who initiated it");
      return false;
    }

    // Don't show if already open
    if (this.activeSheets.has(sheetData.groupId)) {
      console.log("🚫 Sheet already open:", sheetData.groupId);
      return false;
    }

    // Check if sheet is meant for current user (optional targeting)
    if (
      sheetData.targetUsers &&
      !sheetData.targetUsers.includes(game.user?.id)
    ) {
      console.log("🚫 Sheet not targeted for current user");
      return false;
    }

    return true;
  }

  // Show patrol sheet from setting data
  private showPatrolSheetFromSetting(sheetData: any) {
    // Get the group data
    const groups = (game.modules?.get("crow-nest") as any)?.api?.getGroups?.();
    if (!groups) {
      console.error("❌ No groups available");
      return;
    }

    const group = groups.find((g: any) => g.id === sheetData.groupId);
    if (!group) {
      console.error("❌ Group not found:", sheetData.groupId);
      return;
    }

    // Use default labels or provided ones
    const labels = sheetData.labels || { groupSingular: "Patrol" };

    console.log(
      "✅ Opening patrol sheet from setting for group:",
      group.name || group.id
    );
    this.showPatrolSheet(group, labels);
  }

  // NEW: Settings-based method to show patrol sheet to all users
  async forceShowPatrolSheetToAllViaSettings(
    group: Group,
    labels: any,
    options: any = {}
  ) {
    if (!game.user?.isGM) {
      console.log(
        "🚫 forceShowPatrolSheetToAllViaSettings: User is not GM, aborting"
      );
      return;
    }

    console.log(
      "📤 forceShowPatrolSheetToAllViaSettings: GM initiating broadcast for group:",
      group.id
    );

    // Show to GM first if requested
    if (options.showToGM !== false) {
      this.showPatrolSheet(group, labels);
    }

    // Get current active sheets
    const currentSheets = (game as any).settings.get(
      MODULE_ID,
      "activePatrolSheets"
    ) as any[];

    // Create new sheet entry
    const newSheetEntry = {
      groupId: group.id,
      groupName: group.name,
      labels: labels,
      timestamp: Date.now(),
      initiatedBy: game.user.id,
      showToGM: options.showToGM || false,
      targetUsers: options.targetUsers || null, // null means all users
    };

    // Remove any existing entry for this group and add the new one
    const updatedSheets = currentSheets.filter(
      (sheet) => sheet.groupId !== group.id
    );
    updatedSheets.push(newSheetEntry);

    console.log(
      "📡 forceShowPatrolSheetToAllViaSettings: Updating setting with:",
      updatedSheets
    );

    // Update the setting - this will automatically sync to all users!
    await (game as any).settings.set(
      MODULE_ID,
      "activePatrolSheets",
      updatedSheets
    );

    console.log(
      "✅ forceShowPatrolSheetToAllViaSettings: Setting updated successfully"
    );
  }

  // Method to remove a patrol sheet from active list (when closed)
  async removePatrolSheetFromActive(groupId: string) {
    if (!game.user?.isGM) {
      // Only GM can modify the active sheets list
      return;
    }

    const currentSheets = (game as any).settings.get(
      MODULE_ID,
      "activePatrolSheets"
    ) as any[];
    const updatedSheets = currentSheets.filter(
      (sheet) => sheet.groupId !== groupId
    );

    if (updatedSheets.length !== currentSheets.length) {
      console.log("📤 Removing patrol sheet from active list:", groupId);
      await (game as any).settings.set(
        MODULE_ID,
        "activePatrolSheets",
        updatedSheets
      );
    }
  }

  // Method to clear all active patrol sheets (GM only)
  async clearAllActivePatrolSheets() {
    if (!game.user?.isGM) {
      console.log(
        "🚫 clearAllActivePatrolSheets: Only GM can clear active sheets"
      );
      return;
    }

    console.log("🧹 Clearing all active patrol sheets");
    await (game as any).settings.set(MODULE_ID, "activePatrolSheets", []);
    console.log("✅ All active patrol sheets cleared");
  }

  // Debug method to check current active sheets setting
  debugActiveSheetsSetting() {
    const activeSheets = (game as any).settings.get(
      MODULE_ID,
      "activePatrolSheets"
    );
    console.log("🔍 Current active patrol sheets setting:", activeSheets);
    console.log(
      "🔍 Current user:",
      game.user?.name,
      "ID:",
      game.user?.id,
      "isGM:",
      game.user?.isGM
    );
    console.log(
      "🔍 Local active sheets:",
      Array.from(this.activeSheets.keys())
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
