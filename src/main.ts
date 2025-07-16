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

  // Global Fear tracking for non-Daggerheart systems
  game.settings.register(MODULE_ID, "global-fear", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
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

  // Used roll buttons tracking - to prevent multiple uses
  game.settings.register(MODULE_ID, "usedRollButtons", {
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

  // Clean up old button records on startup
  if (game.user?.isGM) {
    cleanupOldButtonRecords();
  }
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

// Hook to handle chat button clicks for Hope/Fear management
Hooks.on("renderChatMessage", (message: any, html: JQuery) => {
  // Handle Hope/Fear buttons in chat
  html.find(".roll-action-btn").on("click", async (event) => {
    const button = event.currentTarget;
    const action = button.dataset.action;
    const rollId = button.dataset.rollId;

    if (!action || !rollId) return;

    // Check if this button has already been used
    const usedButtons = (game as any).settings.get(
      MODULE_ID,
      "usedRollButtons"
    ) as string[];
    const buttonKey = `${rollId}-${action}`;

    if (usedButtons.includes(buttonKey)) {
      // Button already used, don't allow action
      button.disabled = true;
      button.textContent =
        action === "add-hope" ? "Hope Added!" : "Fear Added!";
      button.style.background = "#6c757d";
      return;
    }

    // Find the roll container to get group data
    const rollContainer = html.find(`[data-roll-id="${rollId}"]`);
    if (rollContainer.length === 0) return;

    const groupId = rollContainer.attr("data-group-id");
    if (!groupId) return;

    try {
      if (action === "add-hope") {
        await handleAddHope(groupId);
        button.disabled = true;
        button.textContent = "Hope Added!";
        button.style.background = "#6c757d";

        // Mark button as used
        await markButtonAsUsed(buttonKey);
      } else if (action === "add-fear") {
        await handleAddFear();
        button.disabled = true;
        button.textContent = "Fear Added!";
        button.style.background = "#6c757d";

        // Mark button as used
        await markButtonAsUsed(buttonKey);
      }
    } catch (error) {
      console.error("Error handling roll action:", error);
      ui.notifications?.error("Failed to update counters");
    }
  });

  // Check and disable already used buttons on render
  html.find(".roll-action-btn").each((index, button) => {
    const action = button.dataset.action;
    const rollId = button.dataset.rollId;

    if (!action || !rollId) return;

    const usedButtons = (game as any).settings.get(
      MODULE_ID,
      "usedRollButtons"
    ) as string[];
    const buttonKey = `${rollId}-${action}`;

    if (usedButtons.includes(buttonKey)) {
      button.disabled = true;
      button.textContent =
        action === "add-hope" ? "Hope Added!" : "Fear Added!";
      button.style.background = "#6c757d";
    }
  });
});

// Helper function to mark a button as used
async function markButtonAsUsed(buttonKey: string) {
  const usedButtons = (game as any).settings.get(
    MODULE_ID,
    "usedRollButtons"
  ) as string[];
  if (!usedButtons.includes(buttonKey)) {
    usedButtons.push(buttonKey);
    await (game as any).settings.set(MODULE_ID, "usedRollButtons", usedButtons);
  }
}

// Optional: Clean up old button records (older than 24 hours)
async function cleanupOldButtonRecords() {
  const usedButtons = (game as any).settings.get(
    MODULE_ID,
    "usedRollButtons"
  ) as string[];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  // Filter out old roll IDs (they contain timestamp)
  const cleanedButtons = usedButtons.filter((buttonKey) => {
    const rollId = buttonKey.split("-")[1]; // Extract roll ID
    if (rollId && rollId.startsWith("roll-")) {
      const timestamp = parseInt(rollId.split("-")[1]);
      return timestamp > oneDayAgo;
    }
    return true; // Keep if we can't parse timestamp
  });

  if (cleanedButtons.length !== usedButtons.length) {
    await (game as any).settings.set(
      MODULE_ID,
      "usedRollButtons",
      cleanedButtons
    );
    console.log(
      `Cleaned up ${usedButtons.length - cleanedButtons.length} old button records`
    );
  }
}

async function handleAddHope(groupId: string) {
  // Get current groups
  const groups = (game as any).settings.get(
    MODULE_ID,
    SETTING_PATROLS
  ) as any[];
  const groupIndex = groups.findIndex((g) => g.id === groupId);

  if (groupIndex === -1) {
    ui.notifications?.warn("Patrol not found");
    return;
  }

  const group = groups[groupIndex];
  const newHope = Math.min((group.hope || 0) + 1, group.maxHope || 6);

  // Update the group
  groups[groupIndex] = { ...group, hope: newHope };

  // Save and broadcast the change
  await (game as any).settings.set(MODULE_ID, SETTING_PATROLS, groups);

  // Broadcast sync event
  const syncManager = SyncManager.getInstance();
  syncManager.broadcast({
    type: "groups",
    action: "update",
    data: groups,
    timestamp: Date.now(),
    user: game.user?.name || "unknown",
  });

  ui.notifications?.info(
    `Added Hope to ${group.name || "Patrol"}. Hope: ${newHope}/${group.maxHope || 6}`
  );
}

async function handleAddFear() {
  const game_global = globalThis.game as any;

  if (game_global.system?.id === "daggerheart") {
    console.log("Detected Daggerheart system, attempting to add Fear...");

    try {
      // Use the correct setting name: "ResourcesFear" (not "Resources.Fear")
      const currentFear =
        (game as any).settings.get("daggerheart", "ResourcesFear") || 0;
      console.log("Current Fear value:", currentFear);

      // Use default max fear of 12
      const maxFear = 12;
      const newFear = Math.min(Number(currentFear) + 1, maxFear);
      console.log(`Updating Fear from ${currentFear} to ${newFear}`);

      // Update the Fear setting
      await (game as any).settings.set("daggerheart", "ResourcesFear", newFear);

      ui.notifications?.info(`Fear increased to ${newFear}/${maxFear}`);

      // Send chat message about the fear increase
      ChatMessage.create({
        speaker: { alias: "System" },
        content: `<div style="text-align: center; padding: 0.5rem; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 4px;">
          <i class="fas fa-skull" style="color: #dc3545;"></i>
          <strong style="color: #dc3545;">Fear increased to ${newFear}/${maxFear}</strong>
        </div>`,
      });

      console.log("Fear successfully updated!");
    } catch (error) {
      console.error("Failed to update Daggerheart Fear:", error);
      ui.notifications?.warn(
        "Unable to add Fear to system. Please manually add Fear or check Daggerheart configuration."
      );

      // Send chat message indicating manual action needed
      ChatMessage.create({
        speaker: { alias: "Crow Nest" },
        content: `<div style="text-align: center; padding: 0.5rem; background: rgba(255, 193, 7, 0.1); border: 1px solid #ffc107; border-radius: 4px;">
          <i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i>
          <strong style="color: #ffc107;">Fear roll result - GM please add 1 Fear manually</strong>
        </div>`,
      });
    }
  } else {
    // Not Daggerheart system
    ui.notifications?.info("Fear tracking requires Daggerheart system");

    ChatMessage.create({
      speaker: { alias: "Crow Nest" },
      content: `<div style="text-align: center; padding: 0.5rem; background: rgba(255, 193, 7, 0.1); border: 1px solid #ffc107; border-radius: 4px;">
        <i class="fas fa-info-circle" style="color: #ffc107;"></i>
        <strong style="color: #ffc107;">Fear result noted - Requires Daggerheart system</strong>
      </div>`,
    });
  }
}
