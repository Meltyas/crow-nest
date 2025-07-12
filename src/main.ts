import Hud from "@/components/hud/hud.svelte";
import {
  patrolSheetManager,
  PatrolSheetManager,
} from "@/components/patrol-sheet/patrol-sheet";
import {
  MODULE_ID,
  SETTING_ADMINS,
  SETTING_LOG,
  SETTING_MODIFIERS,
  SETTING_PATROLS,
  SETTING_REPUTATION,
  SETTING_RESOURCES,
  SETTING_STATS,
} from "@/constants";
import { getPatrols } from "@/patrol/patrols";
import { initializeSync, SyncManager, testPatrolSheetSync, cleanupSync } from "@/utils/sync";
import { initializeGroupsSync } from "@/stores/groups";
import "./styles/global.pcss";

Hooks.once("init", () => {
  console.log("Crow Nest | Initializing module");
  game.settings.register(MODULE_ID, SETTING_STATS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_LOG, {
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
function handlePatrolSheetSettingChange(activeSheets: any, updatedByUserId: string) {
  console.log("🎯🎯🎯 FUNCTION CALLED: handlePatrolSheetSettingChange");
  console.log("🎯 main.ts: Handling patrol sheet setting change");
  console.log("🎯 Raw activeSheets data:", activeSheets, "type:", typeof activeSheets);
  console.log("🎯 Updated by user:", updatedByUserId);
  console.log("🎯 Current user:", game.user?.name, "ID:", game.user?.id, "isGM:", game.user?.isGM);
  
  // Ensure activeSheets is an array
  let sheetsArray: any[] = [];
  if (Array.isArray(activeSheets)) {
    sheetsArray = activeSheets;
  } else if (activeSheets && typeof activeSheets === 'object' && activeSheets.value) {
    // Foundry passes {value: "JSON_STRING"} structure - need to parse the JSON string!
    console.log("🎯 Found value property, parsing JSON string:", activeSheets.value);
    try {
      const parsedValue = JSON.parse(activeSheets.value);
      if (Array.isArray(parsedValue)) {
        sheetsArray = parsedValue;
        console.log("✅ Successfully parsed JSON string to array");
      } else {
        console.log("🚫 Parsed value is not an array:", parsedValue);
      }
    } catch (error) {
      console.error("❌ Error parsing JSON string:", error);
      return;
    }
  } else {
    console.log("🚫 activeSheets is not an array and has no parseable value, skipping processing");
    return;
  }
  
  console.log("🎯 Processed sheets array:", sheetsArray);
  
  // Don't process updates from our own user (to avoid loops)
  if (updatedByUserId === game.user?.id) {
    console.log("🚫 Ignoring update from self to avoid loops");
    return;
  }
  
  // Get available groups
  const groups = (game.modules?.get("crow-nest") as any)?.api?.getGroups?.();
  if (!groups) {
    console.error("❌ No groups available in main.ts handler");
    return;
  }
  
  console.log("🎯 Available groups:", groups.length);
  
  // Process each active sheet
  sheetsArray.forEach((sheetData: any) => {
    console.log("🎯 Processing sheet data:", sheetData);
    
    // Check if we should show this sheet to current user
    const shouldShow = shouldShowPatrolSheetToCurrentUser(sheetData);
    console.log("🎯 Should show to current user:", shouldShow);
    
    if (shouldShow) {
      // Find the group
      const group = groups.find((g: any) => g.id === sheetData.groupId);
      if (group) {
        console.log("✅ Opening patrol sheet directly from main.ts for group:", group.name || group.id);
        
        // Use default labels or provided ones
        const labels = sheetData.labels || { groupSingular: "Patrol" };
        
        // Open the patrol sheet directly - same way the button does it!
        console.log("🚀 CALLING patrolSheetManager.showPatrolSheet...");
        patrolSheetManager.showPatrolSheet(group, labels);
        console.log("✅ Patrol sheet opened successfully from main.ts");
      } else {
        console.error("❌ Group not found:", sheetData.groupId);
      }
    } else {
      console.log("🚫 Not showing patrol sheet for this user");
    }
  });
  
  console.log("🎯 Finished processing patrol sheet setting change in main.ts");
}

// Helper function to check if current user should see the patrol sheet
function shouldShowPatrolSheetToCurrentUser(sheetData: any): boolean {
  console.log("🔍🔍🔍 FUNCTION CALLED: shouldShowPatrolSheetToCurrentUser");
  console.log("🔍 main.ts: Checking if should show patrol sheet:", sheetData);
  
  // Don't show to GM if they initiated it (unless specifically requested)
  if (game.user?.isGM && sheetData.initiatedBy === game.user.id && !sheetData.showToGM) {
    console.log("🚫 Skipping show for GM who initiated it");
    return false;
  }
  
  // Don't show if already open
  if (patrolSheetManager.activeSheets?.has(sheetData.groupId)) {
    console.log("🚫 Sheet already open:", sheetData.groupId);
    return false;
  }
  
  // Check if sheet is meant for current user (optional targeting)
  if (sheetData.targetUsers && !sheetData.targetUsers.includes(game.user?.id)) {
    console.log("🚫 Sheet not targeted for current user");
    return false;
  }
  
  console.log("✅ Should show patrol sheet to current user - all checks passed");
  return true;
}

Hooks.once("ready", () => {
  console.log("Crow Nest | Ready");

  // Initialize real-time synchronization
  console.log("Crow Nest | Initializing sync system");
  initializeSync();

  // Initialize global groups sync (always active)
  console.log("Crow Nest | Initializing global groups sync");
  initializeGroupsSync();

  // Clean up any existing sync system first
  console.log("Crow Nest | Cleaning up existing sync system");
  cleanupSync();

  // Initialize patrol sheet manager
  console.log("Crow Nest | Initializing patrol sheet system");
  patrolSheetManager; // Esto inicializa la instancia

  // Set up patrol sheet setting watcher (much simpler than sockets!)
  console.log("Crow Nest | Setting up patrol sheet setting watcher");
  game.settings.sheet.render(); // Ensure settings are ready
  
  // Watch for changes in activePatrolSheets setting
  Hooks.on("updateSetting", (setting, value, options, userId) => {
    console.log("🎣 HOOK FIRED: updateSetting - setting key:", setting.key);
    
    if (setting.key === `${MODULE_ID}.activePatrolSheets`) {
      console.log("✅ CORRECT SETTING DETECTED: activePatrolSheets");
      console.log("📡 Patrol sheet setting changed:", value, "by user:", userId);
      
      // Handle patrol sheet opening directly in main.ts (simpler approach)
      console.log("🚀 CALLING handlePatrolSheetSettingChange...");
      handlePatrolSheetSettingChange(value, userId);
      console.log("✅ handlePatrolSheetSettingChange call completed");
    } else {
      console.log("❌ Different setting, ignoring:", setting.key);
    }
  });

  // Initialize patrol sheet sync handlers (always active for all users)
  console.log("Crow Nest | Registering patrol sheet sync handlers");
  const syncManager = SyncManager.getInstance();
  
  // Clear any existing patrol-sheet handlers first
  syncManager.clearEventHandler("patrol-sheet");
  
  syncManager.registerEventHandler("patrol-sheet", (event) => {
    patrolSheetManager.handleSyncEvent(event);
  });
  console.log("✅ Crow Nest | Patrol sheet sync handlers registered");

  // Expose API for external access
  (game.modules.get(MODULE_ID) as any).api = {
    getGroups: () => getPatrols(),
    patrolSheetManager: patrolSheetManager,
    // Explicitly expose the forceShowPatrolSheetToAll method
    forceShowPatrolSheetToAll: (group: any, labels: any) => patrolSheetManager.forceShowPatrolSheetToAll(group, labels),
    testPatrolSheetSync: testPatrolSheetSync,
    debugPatrolSheets: () => patrolSheetManager.debugState(),
    debugSyncHandlers: () => patrolSheetManager.debugSyncHandlers(),
    testSyncCommunication: () => patrolSheetManager.testSyncCommunication(),
    testSocketReception: () => patrolSheetManager.testSocketReception(),
    testSocketDirectly: () => patrolSheetManager.testSocketDirectly(),
    debugSocketSystem: () => patrolSheetManager.debugSocketSystem(),
    forceSocketReinitialization: () => patrolSheetManager.forceSocketReinitialization(),
    // NEW: Settings-based patrol sheet methods
    forceShowPatrolSheetToAllViaSettings: (group: any, labels: any, options: any = {}) => 
      patrolSheetManager.forceShowPatrolSheetToAllViaSettings(group, labels, options),
    clearAllActivePatrolSheets: () => patrolSheetManager.clearAllActivePatrolSheets(),
    debugActiveSheetsSetting: () => patrolSheetManager.debugActiveSheetsSetting(),
    clearPatrolPositions: () => patrolSheetManager.clearStoredPositions(),
    // Cleanup functions for sync issues
    cleanupSync: () => patrolSheetManager.manualCleanupSync(),
    reinitializeSync: () => {
      console.log("🔄 Manual reinitialize: Cleaning and restarting sync");
      patrolSheetManager.manualCleanupSync();
      initializeSync();
      const syncManager = SyncManager.getInstance();
      syncManager.clearEventHandler("patrol-sheet");
      syncManager.registerEventHandler("patrol-sheet", (event) => {
        patrolSheetManager.handleSyncEvent(event);
      });
      console.log("✅ Sync system reinitialized");
      return { success: true, message: "Sync system reinitialized" };
    },
    // New sync diagnostic functions
    testGroupsSync: () => {
      console.log("🧪 Testing groups sync...");
      const syncManager = SyncManager.getInstance();
      const testEvent = {
        type: "groups" as const,
        action: "update" as const,
        data: [{ id: "test", name: "Test Group", officer: null, soldiers: [], mods: {} }],
        timestamp: Date.now(),
        user: game.user?.name || "unknown"
      };
      console.log("📤 Broadcasting test groups event:", testEvent);
      syncManager.broadcast(testEvent);
    },
    checkSyncListeners: () => {
      const syncManager = SyncManager.getInstance();
      console.log("🔍 Sync Listeners Debug:");
      console.log("SyncManager instance:", syncManager);
      console.log("Total listeners:", syncManager.getListenerCount());
      console.log("Event handlers count:", syncManager.getEventHandlerCount());
      console.log("Groups listeners:", syncManager.getListenerCount('groups'));
      console.log("All listeners by type:");
      
      const listeners = syncManager.getListeners();
      for (const [type, callbacks] of listeners.entries()) {
        console.log(`  ${type}: ${callbacks.length} listeners`);
      }
      
      return {
        totalListeners: syncManager.getListenerCount(),
        eventHandlersCount: syncManager.getEventHandlerCount(),
        groupsListeners: syncManager.getListenerCount('groups'),
        listenersByType: Array.from(listeners.entries()).map(([type, callbacks]) => ({
          type,
          count: callbacks.length
        }))
      };
    },
    checkLocalStorage: () => {
      const activeSheets = localStorage.getItem("crow-nest-open-patrol-sheets");
      const positions = localStorage.getItem("crow-nest-patrol-positions");
      console.log("🔍 LocalStorage Debug:");
      console.log(
        "Active sheets:",
        activeSheets ? JSON.parse(activeSheets) : null
      );
      console.log(
        "Position history:",
        positions ? JSON.parse(positions) : null
      );
      return {
        activeSheets: activeSheets ? JSON.parse(activeSheets) : null,
        positions: positions ? JSON.parse(positions) : null,
      };
    },
  };

  // Create HUD
  console.log("Crow Nest | Creating HUD");
  const container = document.createElement("div");
  container.style.position = "absolute";
  document.body.appendChild(container);
  new Hud({ target: container });
  console.log("Crow Nest | HUD created successfully");
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
      console.log("🧪 Testing sync communication...");
      console.log("Current user:", game.user?.name, "isGM:", game.user?.isGM);

      // Test basic socket
      if (game.socket) {
        const testData = {
          test: "manual test",
          timestamp: Date.now(),
          from: game.user?.name,
          isGM: game.user?.isGM,
        };

        console.log("Sending test data:", testData);
        game.socket.emit(`module.${MODULE_ID}-test`, testData);

        // Also test the main channel
        const syncEvent = {
          type: "patrol-sheet",
          action: "show",
          data: { test: "patrol sheet communication test" },
          timestamp: Date.now(),
          user: game.user?.name ?? "unknown",
        };

        console.log("Sending sync event:", syncEvent);
        game.socket.emit(`module.${MODULE_ID}`, syncEvent);
      }
    },
    testShowPatrolToAll: () => {
      console.log("🧪 Testing show patrol to all...");
      const patrol = PatrolSheetManager.getInstance();
      if (patrol.currentGroup) {
        console.log("Current group:", patrol.currentGroup);
        patrol.showPatrolSheetToAll(patrol.currentGroup);
      } else {
        console.log("No current group available");
      }
    },
    forceShowPatrol: (groupData: any) => {
      console.log("🧪 Force showing patrol:", groupData);
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
      console.log("🔍 Socket Status Check:");
      console.log("Socket exists:", !!game.socket);
      console.log("Socket connected:", game.socket?.connected);
      console.log("Socket ID:", game.socket?.id);
      console.log("User:", game.user?.name, "ID:", game.user?.id);
      console.log("Is GM:", game.user?.isGM);
      console.log(
        "Connected users:",
        game.users?.contents?.map((u) => ({
          name: u.name,
          id: u.id,
          active: u.active,
          role: u.role,
          isGM: u.isGM,
        }))
      );
    },
    simulatePlayerReceive: () => {
      console.log("🎭 Simulating player receive...");
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
