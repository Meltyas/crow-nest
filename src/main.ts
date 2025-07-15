import Hud from "@/components/hud/hud.svelte";
import {
  patrolSheetManager,
  PatrolSheetManager,
} from "@/components/patrol-sheet/patrol-sheet";
import {
  MODULE_ID,
  SETTING_ADMINS,
  SETTING_MODIFIERS,
  SETTING_PATROLS,
  SETTING_REPUTATION,
  SETTING_RESOURCES,
  SETTING_STATS,
} from "@/constants";
import { getPatrols } from "@/patrol/patrols";
import { initializeGroupsSync } from "@/stores/groups";
import {
  cleanupSync,
  initializeSync,
  SyncManager,
  testPatrolSheetSync,
} from "@/utils/sync";
import "./styles/font.css";
import "./styles/global.pcss";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_STATS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_MODIFIERS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_RESOURCES, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_PATROLS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_ADMINS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_REPUTATION, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  // Game tokens (Despair and Cheers) - GM only
  game.settings.register(MODULE_ID, "gameTokens", {
    scope: "world",
    config: false,
    type: Object,
    default: { despair: 0, cheers: 0 },
  });

  // Active patrol sheets - synchronized across all users
  game.settings.register(MODULE_ID, "activePatrolSheets", {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
});

// Function to handle patrol sheet setting changes directly
function handlePatrolSheetSettingChange(
  activeSheets: any,
  updatedByUserId: string
) {
  // Ensure activeSheets is an array
  let sheetsArray: any[] = [];
  if (Array.isArray(activeSheets)) {
    sheetsArray = activeSheets;
  } else if (
    activeSheets &&
    typeof activeSheets === "object" &&
    activeSheets.value
  ) {
    // Foundry passes {value: "JSON_STRING"} structure - need to parse the JSON string!
    try {
      const parsedValue = JSON.parse(activeSheets.value);
      if (Array.isArray(parsedValue)) {
        sheetsArray = parsedValue;
      }
    } catch (error) {
      return;
    }
  } else {
    return;
  }

  // Don't process updates from our own user (to avoid loops)
  if (updatedByUserId === game.user?.id) {
    return;
  }

  // Get available groups
  const groups = (game.modules?.get("crow-nest") as any)?.api?.getGroups?.();
  if (!groups) {
    return;
  }

  // Process each active sheet
  sheetsArray.forEach((sheetData: any) => {
    // Check if we should show this sheet to current user
    const shouldShow = shouldShowPatrolSheetToCurrentUser(sheetData);

    if (shouldShow) {
      // Find the group
      const group = groups.find((g: any) => g.id === sheetData.groupId);
      if (group) {
        // Use default labels or provided ones
        const labels = sheetData.labels || { groupSingular: "Patrol" };

        // Open the patrol sheet directly - same way the button does it!
        patrolSheetManager.showPatrolSheet(group, labels);
      }
    }
  });
}

// Helper function to check if current user should see the patrol sheet
function shouldShowPatrolSheetToCurrentUser(sheetData: any): boolean {
  // Don't show to GM if they initiated it (unless specifically requested)
  if (
    game.user?.isGM &&
    sheetData.initiatedBy === game.user.id &&
    !sheetData.showToGM
  ) {
    return false;
  }

  // Don't show if already open
  if (patrolSheetManager.activeSheets?.has(sheetData.groupId)) {
    return false;
  }

  // Check if sheet is meant for current user (optional targeting)
  if (sheetData.targetUsers && !sheetData.targetUsers.includes(game.user?.id)) {
    return false;
  }

  return true;
}

Hooks.once("ready", () => {
  // Initialize real-time synchronization
  initializeSync();

  // Initialize global groups sync (always active)
  initializeGroupsSync();

  // Clean up any existing sync system first
  cleanupSync();

  // Initialize patrol sheet manager
  patrolSheetManager; // Esto inicializa la instancia

  // Set up patrol sheet setting watcher (much simpler than sockets!)
  game.settings.sheet.render(); // Ensure settings are ready

  // Watch for changes in activePatrolSheets setting
  Hooks.on("updateSetting", (setting, value, options, userId) => {
    if (setting.key === `${MODULE_ID}.activePatrolSheets`) {
      handlePatrolSheetSettingChange(value, userId);
    }
  });

  // Initialize patrol sheet sync handlers (always active for all users)
  const syncManager = SyncManager.getInstance();

  // Clear any existing patrol-sheet handlers first
  syncManager.clearEventHandler("patrol-sheet");

  syncManager.registerEventHandler("patrol-sheet", (event) => {
    patrolSheetManager.handleSyncEvent(event);
  });

  // Expose API for external access
  (game.modules.get(MODULE_ID) as any).api = {
    getGroups: () => getPatrols(),
    patrolSheetManager: patrolSheetManager,
    // Explicitly expose the forceShowPatrolSheetToAll method
    forceShowPatrolSheetToAll: (group: any, labels: any) =>
      patrolSheetManager.forceShowPatrolSheetToAll(group, labels),
    testPatrolSheetSync: testPatrolSheetSync,
    debugPatrolSheets: () => patrolSheetManager.debugState(),
    debugSyncHandlers: () => patrolSheetManager.debugSyncHandlers(),
    testSyncCommunication: () => patrolSheetManager.testSyncCommunication(),
    testSocketReception: () => patrolSheetManager.testSocketReception(),
    testSocketDirectly: () => patrolSheetManager.testSocketDirectly(),
    debugSocketSystem: () => patrolSheetManager.debugSocketSystem(),
    forceSocketReinitialization: () =>
      patrolSheetManager.forceSocketReinitialization(),
    // NEW: Settings-based patrol sheet methods
    forceShowPatrolSheetToAllViaSettings: (
      group: any,
      labels: any,
      options: any = {}
    ) =>
      patrolSheetManager.forceShowPatrolSheetToAllViaSettings(
        group,
        labels,
        options
      ),
    clearAllActivePatrolSheets: () =>
      patrolSheetManager.clearAllActivePatrolSheets(),
    debugActiveSheetsSetting: () =>
      patrolSheetManager.debugActiveSheetsSetting(),
    clearPatrolPositions: () => patrolSheetManager.clearStoredPositions(),
    // Cleanup functions for sync issues
    cleanupSync: () => patrolSheetManager.manualCleanupSync(),
    reinitializeSync: () => {
      patrolSheetManager.manualCleanupSync();
      initializeSync();
      const syncManager = SyncManager.getInstance();
      syncManager.clearEventHandler("patrol-sheet");
      syncManager.registerEventHandler("patrol-sheet", (event) => {
        patrolSheetManager.handleSyncEvent(event);
      });
      return { success: true, message: "Sync system reinitialized" };
    },
    // New sync diagnostic functions
    testGroupsSync: () => {
      const syncManager = SyncManager.getInstance();
      const testEvent = {
        type: "groups" as const,
        action: "update" as const,
        data: [
          {
            id: "test",
            name: "Test Group",
            officer: null,
            soldiers: [],
            mods: {},
          },
        ],
        timestamp: Date.now(),
        user: game.user?.name || "unknown",
      };
      syncManager.broadcast(testEvent);
    },
    checkSyncListeners: () => {
      const syncManager = SyncManager.getInstance();

      const listeners = syncManager.getListeners();
      for (const [type, callbacks] of listeners.entries()) {
        // Silent iteration
      }

      return {
        totalListeners: syncManager.getListenerCount(),
        eventHandlersCount: syncManager.getEventHandlerCount(),
        groupsListeners: syncManager.getListenerCount("groups"),
        listenersByType: Array.from(listeners.entries()).map(
          ([type, callbacks]) => ({
            type,
            count: callbacks.length,
          })
        ),
      };
    },
    checkLocalStorage: () => {
      const activeSheets = localStorage.getItem("crow-nest-open-patrol-sheets");
      const positions = localStorage.getItem("crow-nest-patrol-positions");

      return {
        activeSheets: activeSheets ? JSON.parse(activeSheets) : null,
        positions: positions ? JSON.parse(positions) : null,
      };
    },
  };

  // Create HUD
  const container = document.createElement("div");
  container.style.position = "absolute";
  document.body.appendChild(container);
  new Hud({ target: container });
});

Hooks.on("getActorSheetHeaderButtons", (sheet: any, buttons: any[]) => {
  // Removed old OrganizationStatsApp - now using the new tab system in HUD
});

Hooks.on("dropCanvasData", async (canvas: any, data: any) => {
  if (data.type !== "CrowPatrol") return;
  const patrol = getPatrols().find((p) => p.id === data.patrolId);
  if (!patrol) return false;

  const members = [] as any[];
  if (patrol.officer) members.push(patrol.officer);
  members.push(...patrol.soldiers);

  const grid = canvas.grid.size;
  let offsetX = 0;
  let offsetY = 0;
  const tokensToCreate = [] as any[];
  const tokensToMove = [] as any[];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const actor = game.actors?.get(m.id);
    if (!actor) continue;

    // Check if token already exists on canvas
    const existingToken = canvas.tokens.placeables.find(
      (token: any) => token.document.actorId === actor.id
    );

    const newX = data.x + offsetX;
    const newY = data.y + offsetY;

    if (existingToken) {
      // Move existing token
      tokensToMove.push({
        _id: existingToken.document.id,
        x: newX,
        y: newY,
      });
    } else {
      // Create new token
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
    // Move tokens individually by updating their documents
    for (const tokenUpdate of tokensToMove) {
      const token = canvas.tokens.get(tokenUpdate._id);
      if (token) {
        // Update token document position directly
        await token.document.update({
          x: tokenUpdate.x,
          y: tokenUpdate.y,
        });
      }
    }
  }

  if (tokensToCreate.length) {
    await canvas.scene?.createEmbeddedDocuments("Token", tokensToCreate);
  }

  return false;
});

// API for debugging purposes
if (typeof globalThis !== "undefined") {
  globalThis.CrowNest = {
    patrol: PatrolSheetManager.getInstance(),
    testSyncCommunication: () => {
      if (game.socket) {
        const testData = {
          test: "manual test",
          timestamp: Date.now(),
          from: game.user?.name,
          isGM: game.user?.isGM,
        };

        game.socket.emit(`module.${MODULE_ID}-test`, testData);

        // Also test the main channel
        const syncEvent = {
          type: "patrol-sheet",
          action: "show",
          data: { test: "patrol sheet communication test" },
          timestamp: Date.now(),
          user: game.user?.name ?? "unknown",
        };

        game.socket.emit(`module.${MODULE_ID}`, syncEvent);
      }
    },
    testShowPatrolToAll: () => {
      const patrol = PatrolSheetManager.getInstance();
      if (patrol.currentGroup) {
        patrol.showPatrolSheetToAll(patrol.currentGroup);
      }
    },
    forceShowPatrol: (groupData: any) => {
      const syncManager = SyncManager.getInstance();
      const event = {
        type: "patrol-sheet" as const,
        action: "show" as const,
        data: groupData,
        timestamp: Date.now(),
        user: game.user?.name ?? "unknown",
      };
      syncManager.broadcast(event);
    },
    checkSocketStatus: () => {
      return {
        socketExists: !!game.socket,
        socketConnected: game.socket?.connected,
        socketId: game.socket?.id,
        user: {
          name: game.user?.name,
          id: game.user?.id,
          isGM: game.user?.isGM,
        },
        connectedUsers: game.users?.contents?.map((u) => ({
          name: u.name,
          id: u.id,
          active: u.active,
          role: u.role,
          isGM: u.isGM,
        })),
      };
    },
    simulatePlayerReceive: () => {
      const fakePatrolData = {
        id: "test-patrol-123",
        name: "Test Patrol",
        officer: { name: "Test Officer", img: "icons/svg/mystery-man.svg" },
        soldiers: [],
        mods: {},
      };

      // Directly call the handler as if received from socket
      const patrol = PatrolSheetManager.getInstance();
      patrol.handleShowPatrolSheet(fakePatrolData);
    },
  };
}
